import * as vscode from 'vscode';
import * as cp from 'child_process';
import { get } from 'http';
import * as fs from 'fs';

export async function activate(context: vscode.ExtensionContext) {

	if (await isPebbleProject()) {
		vscode.commands.executeCommand('setContext', 'pebbleProject', true);
	} else {
		vscode.commands.executeCommand('setContext', 'pebbleProject', false);
	}

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

	const pebbleTaskProvider = vscode.tasks.registerTaskProvider('pebble', {
		provideTasks: async function (): Promise<vscode.Task[]> {
			const tasks : vscode.Task[] = [];

			// const isProject = await isPebbleProject();

			// if (vscode.workspace.workspaceFolders && isProject) {
			// 	// Create a task for building the Pebble project
			// 	const buildTask = new vscode.Task(
			// 		{ type: 'pebble', task: 'build-install' },
			// 		vscode.TaskScope.Workspace,
			// 		'Build and Install Project',
			// 		'pebble',
			// 		new vscode.ShellExecution('pebble build && pebble install --emulator basalt')
			// 	);
			// 	buildTask.group = vscode.TaskGroup.Build;
			// 	buildTask.presentationOptions = {
			// 		reveal: vscode.TaskRevealKind.Always,
			// 		panel: vscode.TaskPanelKind.New
			// 	};
			// 	tasks.push(buildTask);
			// }

			return tasks;
		},
		resolveTask: function (_task: vscode.Task): vscode.Task | undefined {
			// This method is called when a task is resolved
			// You can return the task or undefined if you don't want to resolve it
			return undefined;
		}
	});
	context.subscriptions.push(pebbleTaskProvider);

	context.subscriptions.push(disposable);
}

async function runWithArgs(args = '') {
	const platform = await requestEmulatorPlatform();
	if (!platform) {
		vscode.window.showErrorMessage('No platform selected. Installation cancelled.');
		return;
	}

	const workspacePath = getWorkspacePath();
	if (!workspacePath) {
		vscode.window.showErrorMessage('No workspace folder is open. Please open a workspace folder to run the project.');
		return;
	}

	const terminal = vscode.window.createTerminal(`Pebble Run`);
	terminal.show();
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

export function deactivate() {}


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