// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';

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

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

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