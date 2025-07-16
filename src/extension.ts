import * as vscode from 'vscode';
import { PebbleTreeProvider } from './pebbleTreeProvider';
import * as os from 'os';
import { requestEmulatorPlatform, runWithArgs, requestPhoneIp, runOnPhoneWithArgs } from './run';
import { storeLastPath, getLastPath } from './utils';

export async function activate(context: vscode.ExtensionContext) {
	console.log('Pebble extension activated');

	if (await isPebbleProject()) {
		vscode.commands.executeCommand('setContext', 'pebbleProject', true);
	} else {
		vscode.commands.executeCommand('setContext', 'pebbleProject', false);
	}

	const newProject = vscode.commands.registerCommand('pebble.newProject', () => {
		createProject(context);
	});

	const run = vscode.commands.registerCommand('pebble.runEmulator', async () => {
		runWithArgs();
	});

	const runWithLogs = vscode.commands.registerCommand('pebble.runEmulatorLogs', async () => {
		runWithArgs('--logs');
	});

	const runOnPhone = vscode.commands.registerCommand('pebble.runPhone', async () => {
		runOnPhoneWithArgs();
	});

	const runOnPhoneWithLogs = vscode.commands.registerCommand('pebble.runOnPhoneWithLogs', async () => {
		runOnPhoneWithArgs('--logs');
	});

	const setDefaultPlatform = vscode.commands.registerCommand('pebble.setDefaultPlatform', async () => {
		const platform = await requestEmulatorPlatform();
		if (!platform) {
			return;
		}
		const config = vscode.workspace.getConfiguration('pebble');
		await config.update('defaultPlatform', platform, vscode.ConfigurationTarget.Global);
	});

	const setPhoneIp = vscode.commands.registerCommand('pebble.setPhoneIp', async () => {
		const phoneIp = await requestPhoneIp();
		if (!phoneIp) {
			return;
		}
		const config = vscode.workspace.getConfiguration('pebble');
		await config.update('phoneIp', phoneIp, vscode.ConfigurationTarget.Global);
	});

	const treeDataProvider = new PebbleTreeProvider();
	const treeView = vscode.window.createTreeView('backgroundTreeView', {
		treeDataProvider: treeDataProvider
	});

	context.subscriptions.push(newProject, run, runWithLogs, setDefaultPlatform, runOnPhone, runOnPhoneWithLogs, setPhoneIp, treeView);
}

export function deactivate() {}

async function isPebbleProject() : Promise<boolean> {
	if (!vscode.workspace.workspaceFolders) {
		return false;
	}

	const packageJsonUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'package.json');

	try {
		const fileContent = await vscode.workspace.fs.readFile(packageJsonUri);
		const packageJson = JSON.parse(fileContent.toString());
		return 'pebble' in packageJson;
	} catch {
		return false;
	}
}

async function createProject(context: vscode.ExtensionContext) {

	const projectTypeObject = await vscode.window.showQuickPick([
		{
			label: 'C',
			detail: 'Default',
		},
		{
			label: 'C Simple',
			detail: 'Minimal',
		},
		{
			label: 'C and JS',
			detail: 'With PebbleKitJS',
		}
	], {
		"placeHolder": "Choose a project type"
	});

	if (!projectTypeObject) {
		return;
	}

	const projectType = projectTypeObject.label;

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

	await storeLastPath(context, projectPath);

	let command = 'pebble new-project --c';
	if (projectType === 'C Simple') {
		command += ' --simple';
	} else if (projectType === 'C and JS') {
		command += ' --javascript';
	}

	let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
	if (!terminal) {
		terminal = vscode.window.createTerminal(`Pebble Run`);
	}

	terminal.show();
	terminal.sendText('\x03'); // Send Ctrl+C
	terminal.sendText(`cd ${projectPath}`, true);
	terminal.sendText(`${command} ${projectName}`, true);

	const executionDisposable = vscode.window.onDidEndTerminalShellExecution((event) => {
		if (event.terminal.name === `Pebble Run` && event.execution.commandLine.value === `${command} ${projectName}`) {
			executionDisposable.dispose();

			if (event.exitCode === 0) {
				vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(`${projectPath}/${projectName}`));
			} else {
				vscode.window.showErrorMessage(`Error creating project. Exit code: ${event.exitCode}`);
			}
		}
	});
}