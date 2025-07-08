// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { get } from 'http';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "pebble-vscode" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('pebble-vscode.newProject', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello World from pebble-vscode!');
		createProject();
	});

	const buildDisposable = vscode.commands.registerCommand('pebble-vscode.buildProject', () => {
		buildProject();
	});

	const installDisposable = vscode.commands.registerCommand('pebble-vscode.installOnEmulator', () => {
		installOnEmulator();
	});

	const installWithLogsDisposable = vscode.commands.registerCommand('pebble-vscode.installOnEmulatorWithLogs', () => {
		installOnEmulatorWithLogs();
	});

	const pebbleTaskProvider = vscode.tasks.registerTaskProvider('pebble', {
		provideTasks: () => {
			// Create a task for building the Pebble project
			const buildTask = new vscode.Task(
				{ type: 'pebble', task: 'build-install' },
				vscode.TaskScope.Workspace,
				'Build and Install Project',
				'pebble',
				new vscode.ShellExecution('pebble build && pebble install --emulator basalt')
			);
			buildTask.group = vscode.TaskGroup.Build;
			buildTask.presentationOptions = {
				reveal: vscode.TaskRevealKind.Always,
				panel: vscode.TaskPanelKind.New
			};
			return [buildTask];
		},
		resolveTask(_task: vscode.Task): vscode.Task | undefined {
			// This method is called when a task is resolved
			// You can return the task or undefined if you don't want to resolve it
			return undefined;
		}
	});
	context.subscriptions.push(pebbleTaskProvider);

	context.subscriptions.push(disposable);
	context.subscriptions.push(buildDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}


function getWorkspacePath(): string | undefined {
	// Get the current workspace directory
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

async function buildProject() {
	
	const workspacePath = getWorkspacePath();

	// Run the build command in the terminal
	const terminal = vscode.window.createTerminal(`Pebble Build`);
	terminal.show();
	terminal.sendText(`pebble build`, true);
}

async function installOnEmulator() {
	const platform = await requestEmulatorPlatform();
	if (!platform) {
		vscode.window.showErrorMessage('No platform selected. Installation cancelled.');
		return;
	}
	runInstallOnEmulator(platform);
}

async function requestEmulatorPlatform() {
	const platformMap: { [key: string] : string } = {
		'Pebble Time': 'basalt',
		'Pebble 2': 'diorite',
		'Pebble Time Round': 'chalk',
		'Pebble Time 2': 'emery',
		'Pebble Classic': 'aplite',
	}

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

async function installOnEmulatorWithLogs() {
	const platform = await requestEmulatorPlatform();
	if (!platform) {
		vscode.window.showErrorMessage('No platform selected. Installation cancelled.');
		return;
	}

	const workspacePath = getWorkspacePath();
	if (!workspacePath) {
		vscode.window.showErrorMessage('No workspace folder is open. Please open a workspace folder to install the project.');
		return;
	}

	const terminal = vscode.window.createTerminal(`Pebble Install on Emulator`);
	terminal.show();
	terminal.sendText(`pebble install --emulator ${platform} --logs`, true);
}

async function runInstallOnEmulator(platform: string) {
	cp.exec(`pebble install --emulator ${platform}`, {
		cwd: getWorkspacePath()
	}, (error, stdout, stderr) => {
		if (error) {
			vscode.window.showErrorMessage(`Error installing on emulator: ${error.message}`);
			return;
		}
		if (stderr) {
			vscode.window.showErrorMessage(`Error: ${stderr}`);
			return;
		}
		vscode.window.showInformationMessage(`Installed on emulator`);
	});
}