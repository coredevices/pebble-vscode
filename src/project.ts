import * as vscode from 'vscode';
import * as os from 'os';
import { storeLastPath, getLastPath } from './utils';

export async function createProject(context: vscode.ExtensionContext) {

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

export async function openProject() {
	vscode.commands.executeCommand('workbench.action.files.openFolder');
}