import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

export function getWorkspacePath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder is open. Please open a workspace folder to build the project.');
        return;
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    return workspacePath;
}

export async function storeLastPath(context: vscode.ExtensionContext, folderPath: string) {
    console.log(`Storing last path: ${folderPath}`);
    await context.globalState.update('lastPath', folderPath);
}

export function getLastPath(context: vscode.ExtensionContext): string | undefined {
    return context.globalState.get<string>('lastPath');
}

export async function isPebbleProject() : Promise<boolean> {
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

const execAsync = promisify(exec);

export async function isPebbleSdkInstalled(): Promise<boolean> {
	try {
		const { stdout } = await execAsync('pebble sdk list');
		return stdout.includes('Installed SDKs:') && !stdout.includes('No SDKs installed yet.');
	} catch (error) {
		// If pebble command doesn't exist or fails, SDK is not installed
		return false;
	}
}

export async function installPebbleSdk(): Promise<void> {
	let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
	if (!terminal) {
		terminal = vscode.window.createTerminal(`Pebble Run`);
	}

	terminal.show();
	terminal.sendText('\x03'); // Send Ctrl+C
	terminal.sendText(`pebble sdk install latest`, true);

	const executionDisposable = vscode.window.onDidEndTerminalShellExecution((event) => {
		if (event.terminal.name === `Pebble Run` && event.execution.commandLine.value === `pebble sdk install latest`) {
			executionDisposable.dispose();

			if (event.exitCode === 0) {
				vscode.window.showInformationMessage(`Pebble SDK installed successfully.`);
			} else {
				vscode.window.showErrorMessage(`Error creating project. Exit code: ${event.exitCode}`);
			}
		}
	});
}