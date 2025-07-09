import * as vscode from 'vscode';
import * as cp from 'child_process';
import { get } from 'http';
import * as fs from 'fs';
import { PebbleViewProvider } from './pebbleViewProvider';
import { PebbleTreeProvider } from './pebbleTreeProvider';
import { platform } from 'os';

export async function activate(context: vscode.ExtensionContext) {

	if (await isPebbleProject()) {
		vscode.commands.executeCommand('setContext', 'pebbleProject', true);
	} else {
		vscode.commands.executeCommand('setContext', 'pebbleProject', false);
	}

	// const provider = new PebbleViewProvider(context.extensionUri);

	// context.subscriptions.push(
	// 	vscode.window.registerWebviewViewProvider("pebble-vscode.pebbleView", provider));

	console.log('Pebble extension activated');

	const disposable = vscode.commands.registerCommand('pebble-vscode.newProject', () => {
		createProject();
	});

	const runDisposable = vscode.commands.registerCommand('pebble-vscode.run', async () => {
		runWithArgs();
	});

	const runWithLogsDisposable = vscode.commands.registerCommand('pebble-vscode.runWithLogs', async () => {
		runWithArgs('--logs');
	});

	vscode.commands.registerCommand('pebble-vscode.setDefaultPlatform', async () => {
		const platform = await requestEmulatorPlatform();
		if (!platform) {
			vscode.window.showErrorMessage('No platform selected. Action cancelled.');
			return;
		}
		const config = vscode.workspace.getConfiguration('pebble-vscode');
		await config.update('defaultPlatform', platform, vscode.ConfigurationTarget.Global);
	});

	context.subscriptions.push(disposable);

	const treeDataProvider = new PebbleTreeProvider();
	const treeView = vscode.window.createTreeView('myTreeView', {
		treeDataProvider: treeDataProvider
	});

	// treeView.message = 'This is a Pebble Tree View.';
	context.subscriptions.push(treeView);

	// context.subscriptions.push(vscode.window.registerTreeDataProvider('myTreeView', new PebbleTreeProvider()));
}

export function deactivate() {}

async function runWithArgs(args = '') {
	const platform = await getEmulatorPlatform();
	if (!platform) {
		vscode.window.showErrorMessage('No platform selected. Installation cancelled.');
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

async function createProject() {
	const projectType = await vscode.window.showQuickPick(['C (default)', 'C basic', 'C and JS'], {
	});

	if (!projectType) {
		vscode.window.showErrorMessage('No project type selected. Project creation cancelled.');
		return;
	}

	const projectName = await vscode.window.showInputBox({
		prompt: 'Enter the name of the new project',
	});

	if (!projectName) {
		vscode.window.showErrorMessage('No project name provided. Project creation cancelled.');
		return;
	}

	const folderUri = await vscode.window.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: 'Select a folder to create the project in',
		title: 'Create a new Pebble project',
	});

	if (!folderUri || folderUri.length === 0) {
		vscode.window.showErrorMessage('No folder selected. Project creation cancelled.');
		return;
	}

	const projectPath = folderUri[0].fsPath;

	let command = 'pebble new-project --c';
	if (projectType === 'C simple') {
		command += ' --simple';
	} else if (projectType === 'C and JS') {
		command += ' --javascript';
	}

	cp.exec(`${command} ${projectName}`, {
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
		vscode.window.showInformationMessage(`Project created successfully: ${stdout}`);
		vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(`${projectPath}/${projectName}`));
	});
}

async function getEmulatorPlatform() {
	const defaultPlatform = vscode.workspace.getConfiguration('pebble-vscode').get<string>('defaultPlatform');

	if (defaultPlatform) {
		return defaultPlatform;
	}
	
	const platform = await requestEmulatorPlatform();
	if (!platform) {
		vscode.window.showErrorMessage('No platform selected. Installation cancelled.');
	}

	const setDefault = await vscode.window.showQuickPick(['No', 'Yes'], {
		placeHolder: 'Set this platform as the default for future runs?',
		canPickMany: false,
	});

	if (setDefault === 'Yes') {
		const config = vscode.workspace.getConfiguration('pebble-vscode');
		await config.update('defaultPlatform', platform, vscode.ConfigurationTarget.Global);
	}
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