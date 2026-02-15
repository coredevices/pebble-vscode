import * as vscode from 'vscode';
import * as os from 'os';
import { storeLastPath, getLastPath, isPebbleSdkInstalled, getPebbleVersionInfo, isVersionBelow, upgradePebbleTool, isDevContainer } from './utils';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
import * as cp from 'child_process';

interface ProjectTypeItem extends vscode.QuickPickItem {
	id: string;
}

export async function createProject(context: vscode.ExtensionContext) {

	const projectTypeObject = await vscode.window.showQuickPick<ProjectTypeItem>([
		{
			label: 'C',
			detail: 'Default',
			id: '--c'
		},
		{
			label: 'C and phone-side JS',
			detail: 'With PebbleKitJS',
			id: '--c --javascript'
		},
		{
			label: 'Alloy',
			detail: 'Embedded JS and phone-side JS',
			id: '--alloy'
		},
		{
			label: 'C with AI',
			detail: 'With instructions for Claude Code and Cursor',
			id: '--c --ai'
		}
	], {
		"placeHolder": "Choose a project type"
	});

	if (!projectTypeObject) {
		return;
	}

	const projectType = projectTypeObject.id;

	const projectName = await vscode.window.showInputBox({
		prompt: 'Enter the name of the new project',
	});

	if (!projectName) {
		return;
	}

	let projectPath: string;

	if (isDevContainer()) {
		const baseFolder = process.env.LOCALWORKSPACEFOLDERBASENAME;
		if (!baseFolder) {
			vscode.window.showErrorMessage('LOCALWORKSPACEFOLDERBASENAME environment variable is not set');
			return;
		}
		projectPath = `/workspaces/${baseFolder}`;
	} else {
		const options: vscode.OpenDialogOptions = {
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Create here',
			title: 'Create a new Pebble project',
			defaultUri: vscode.Uri.file(os.homedir())
		};

		const lastPath = getLastPath(context);
		if (lastPath) {
			options.defaultUri = vscode.Uri.file(lastPath);
		}

		const folderUri = await vscode.window.showOpenDialog(options);

		if (!folderUri || folderUri.length === 0) {
			return;
		}

		projectPath = folderUri[0].fsPath;
	}
	console.log(`Creating project at: ${projectPath}`);

	vscode.window.showInformationMessage(`Creating project...`);

	await storeLastPath(context, projectPath);
	
	const versionInfo = await getPebbleVersionInfo();
	console.log('Version info:', versionInfo);
	
	if (versionInfo.toolVersion && isVersionBelow(versionInfo.toolVersion, 5, 0, 6)) {
		const upgraded = await upgradePebbleTool();
		if (!upgraded) {
			return;
		}
	}

	let command = `pebble new-project ${projectType}`;

	const sdkInstalled = await isPebbleSdkInstalled();
	console.log("Pebble SDK installed:", sdkInstalled);
	if (!sdkInstalled) {
		let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
		if (!terminal) {
			terminal = vscode.window.createTerminal(`Pebble Run`);
		}
	
		terminal.show();
		terminal.sendText('\x03'); // Send Ctrl+C
		terminal.sendText(`cd "${projectPath}"`, true);
		terminal.sendText(`${command} "${projectName}"`, true);

		// onDidEndTerminalShellExecution isn't working fully reliably
		const executionDisposable = vscode.window.onDidEndTerminalShellExecution((event) => {
			if (event.terminal.name === `Pebble Run` && event.execution.commandLine.value === `${command} "${projectName}"`) {
				executionDisposable.dispose();

				if (event.exitCode === 0) {
					vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(`${projectPath}/${projectName}`));
				} else {
					vscode.window.showErrorMessage(`Error creating project. Exit code: ${event.exitCode}`);
				}
			}
		});
		return;
	}

	cp.exec(`${command} "${projectName}"`, {
		cwd: projectPath
	}, (error, stdout, stderr) => {
		if (error) {
			vscode.window.showErrorMessage(`Error creating project: ${error.message}`);
			return;
		}
		if (stderr) {
			vscode.window.showErrorMessage(`Error: ${stderr}`);
			return;
		}
		vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(`${projectPath}/${projectName}`));
	});
}

export async function openProject() {
	if (isDevContainer()) {
		const fs = require('fs');
		const path = require('path');
		
		const baseFolder = process.env.LOCALWORKSPACEFOLDERBASENAME;
		if (!baseFolder) {
			vscode.window.showErrorMessage('LOCALWORKSPACEFOLDERBASENAME environment variable is not set');
			return;
		}
		
		try {
			const projectsPath = `/workspaces/${baseFolder}`;
			const entries = fs.readdirSync(projectsPath, { withFileTypes: true });
			
			const folderNames = entries
				.filter((entry: any) => entry.isDirectory() && !entry.name.startsWith('.'))
				.map((entry: any) => entry.name);
			
			if (folderNames.length === 0) {
				vscode.window.showInformationMessage(`No projects found in ${projectsPath}`);
				return;
			}
			
			const selected = await vscode.window.showQuickPick(folderNames, {
				placeHolder: 'Select a project to open',
				title: 'Open Pebble Project'
			});
			
			if (selected) {
				vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(path.join(projectsPath, selected)));
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Error reading projects: ${error}`);
		}
	} else {
		vscode.commands.executeCommand('workbench.action.files.openFolder');
	}
}

export async function changeSDK() {
	let sdkList: string;
	try {
		const { stdout } = await execAsync('pebble sdk list');
		sdkList = stdout;
	} catch (error: any) {
		vscode.window.showErrorMessage(`Failed to get SDK list: ${error.message}`);
		return;
	}

	// Parse output format:
	//   Installed SDKs:
	//   4.9.124
	//   4.9.79 (active)
	//   ...
	//   Available SDKs:
	//   4.5
	//   ...
	const lines = sdkList.split('\n').map(l => l.trim()).filter(l => l.length > 0);
	const sdkEntries: { version: string; isActive: boolean; installed: boolean }[] = [];
	let section: 'installed' | 'available' | null = null;

	for (const line of lines) {
		if (line.startsWith('Installed SDKs')) {
			section = 'installed';
			continue;
		}
		if (line.startsWith('Available SDKs')) {
			section = 'available';
			continue;
		}
		if (line.startsWith('Could not fetch')) {
			continue;
		}
		if (!section) {
			continue;
		}

		const isActive = line.includes('(active)');
		const version = line.replace('(active)', '').trim();
		sdkEntries.push({ version, isActive, installed: section === 'installed' });
	}

	if (sdkEntries.length === 0) {
		vscode.window.showInformationMessage('No SDKs available.');
		return;
	}

	const items: vscode.QuickPickItem[] = sdkEntries.map(entry => ({
		label: entry.version,
		description: entry.isActive ? '(active)' : entry.installed ? '(installed)' : '(not installed)'
	}));

	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select an SDK version'
	});

	if (!selected) {
		return;
	}

	const version = selected.label;
	const entry = sdkEntries.find(e => e.version === version);

	if (entry?.isActive) {
		vscode.window.showInformationMessage(`SDK ${version} is already active.`);
		return;
	}

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: entry?.installed ? `Activating SDK ${version}...` : `Installing SDK ${version}...`,
		cancellable: false
	}, async () => {
		try {
			if (entry?.installed) {
				await execAsync(`pebble sdk activate ${version}`);
				vscode.window.showInformationMessage(`Switched to SDK ${version}.`);
			} else {
				await execAsync(`pebble sdk install ${version}`);
				vscode.window.showInformationMessage(`Installed and activated SDK ${version}.`);
			}
		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to switch SDK: ${error.message}`);
		}
	});
}