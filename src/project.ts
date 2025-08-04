import * as vscode from 'vscode';
import * as os from 'os';
import { storeLastPath, getLastPath, isPebbleSdkInstalled, getPebbleVersionInfo, isVersionBelow, upgradePebbleTool } from './utils';
import * as cp from 'child_process';

interface ProjectTypeItem extends vscode.QuickPickItem {
	id: string;
}

export async function createProject(context: vscode.ExtensionContext) {

	const projectTypeObject = await vscode.window.showQuickPick<ProjectTypeItem>([
		{
			label: 'C',
			detail: 'Default',
			id: 'c'
		},
		{
			label: 'C simple',
			detail: 'Minimal',
			id: 'c-simple'
		},
		{
			label: 'C and phone-side JS',
			detail: 'With PebbleKitJS',
			id: 'c-pkjs'
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

	const projectPath = folderUri[0].fsPath;
	console.log(`Creating project at: ${projectPath}`);

	await storeLastPath(context, projectPath);
	
	const versionInfo = await getPebbleVersionInfo();
	console.log('Version info:', versionInfo);
	
	if (versionInfo.toolVersion && isVersionBelow(versionInfo.toolVersion, 5, 0, 6)) {
		const upgraded = await upgradePebbleTool();
		if (!upgraded) {
			return;
		}
	}

	let command = 'pebble new-project --c';
	if (projectType === 'c-simple') {
		command += ' --simple';
	} else if (projectType === 'c-pkjs') {
		command += ' --javascript';
	}

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
	vscode.commands.executeCommand('workbench.action.files.openFolder');
}