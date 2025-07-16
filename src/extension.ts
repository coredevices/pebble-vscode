import * as vscode from 'vscode';
import * as cp from 'child_process';
import { get } from 'http';
import * as fs from 'fs';
import { PebbleTreeProvider } from './pebbleTreeProvider';
import { platform } from 'os';
import * as os from 'os';
import * as path from 'path';

export async function activate(context: vscode.ExtensionContext) {

	if (await isPebbleProject()) {
		vscode.commands.executeCommand('setContext', 'pebbleProject', true);
	} else {
		vscode.commands.executeCommand('setContext', 'pebbleProject', false);
	}

	console.log('Pebble extension activated');

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

	// treeView.message = 'This is a Pebble Tree View.';
	context.subscriptions.push(treeView);

	// context.subscriptions.push(vscode.window.registerTreeDataProvider('myTreeView', new PebbleTreeProvider()));

	context.subscriptions.push(newProject, run, runWithLogs, setDefaultPlatform, runOnPhone, runOnPhoneWithLogs, setPhoneIp);
}

export function deactivate() {}

async function storeLastPath(context: vscode.ExtensionContext, folderPath: string) {
	console.log(`Storing last path: ${folderPath}`);
	await context.globalState.update('lastPath', folderPath);
}

function getLastPath(context: vscode.ExtensionContext): string | undefined {
	return context.globalState.get<string>('lastPath');
}

async function runOnPhoneWithArgs(args = '') {
	const workspacePath = getWorkspacePath();
	if (!workspacePath) {
		vscode.window.showErrorMessage('No workspace folder is open. Please open a workspace folder to run the project.');
		return;
	}

	const phoneIp = await getPhoneIp();
	if (!phoneIp) {
		return;
	}

	let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
	if (!terminal) {
		terminal = vscode.window.createTerminal(`Pebble Run`);
	}

	terminal.show();
	terminal.sendText('\x03'); // Send Ctrl+C
	terminal.sendText(`pebble build && pebble install --phone ${phoneIp}${args ? ' ' + args : ''}`, true);
}

async function getPhoneIp() {

	const storedPhoneIp = vscode.workspace.getConfiguration('pebble').get<string>('phoneIp');
	if (storedPhoneIp) {
		return storedPhoneIp;
	}

	const phoneIp = await requestPhoneIp();
	if (!phoneIp) {
		return;
	}

	const setDefault = await vscode.window.showQuickPick(['No', 'Yes'], {
		placeHolder: 'Set this IP as the default for future runs?',
		canPickMany: false,
	});

	if (setDefault === 'Yes') {
		const config = vscode.workspace.getConfiguration('pebble');
		await config.update('phoneIp', phoneIp, vscode.ConfigurationTarget.Global);
	}

	return phoneIp;
};

async function requestPhoneIp() {
	const phoneIp = await vscode.window.showInputBox({
		prompt: 'Enter the IP address of phone. Find it in developer settings on your Pebble app.'
	});

	return phoneIp;
}

async function runWithArgs(args = '') {
	const platform = await getEmulatorPlatform();
	if (!platform) {
		return;
	}

	const workspacePath = getWorkspacePath();
	if (!workspacePath) {
		vscode.window.showErrorMessage('No workspace folder is open. Please open a workspace folder to run the project.');
		return;
	}

	let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
	if (!terminal) {
		terminal = vscode.window.createTerminal(`Pebble Run`);
	}

	terminal.show();
	terminal.sendText('\x03'); // Send Ctrl+C
	terminal.sendText(`pebble build && pebble install --emulator ${platform}${args ? ' ' + args : ''}`, true);
}

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

function getWorkspacePath(): string | undefined {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('No workspace folder is open. Please open a workspace folder to build the project.');
		return;
	}
	const workspacePath = workspaceFolders[0].uri.fsPath;
	return workspacePath;
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

async function getEmulatorPlatform() {
	const defaultPlatform = vscode.workspace.getConfiguration('pebble').get<string>('defaultPlatform');

	if (defaultPlatform) {
		return defaultPlatform;
	}
	
	const platform = await requestEmulatorPlatform();
	if (!platform) {
		return;
	}

	const setDefault = await vscode.window.showQuickPick(['No', 'Yes'], {
		placeHolder: 'Set this platform as the default for future runs?',
		canPickMany: false,
	});

	if (setDefault === 'Yes') {
		const config = vscode.workspace.getConfiguration('pebble');
		await config.update('defaultPlatform', platform, vscode.ConfigurationTarget.Global);
	}

	return platform;
}

async function requestEmulatorPlatform() {
	const platformMap: { [key: string] : string } = {
		'Pebble Classic': 'aplite',
		'Pebble Time': 'basalt',
		'Pebble Time Round': 'chalk',
		'Pebble 2': 'diorite',
		'Pebble Time 2': 'emery',
	};

	const platformName = await vscode.window.showQuickPick(Object.keys(platformMap), {
		placeHolder: 'Select a platform to emulate',
		canPickMany: false,
	});
	
	if (!platformName) {
		return;
	}

	const platform = platformMap[platformName];
	return platform;
}