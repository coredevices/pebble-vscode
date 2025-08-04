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

export interface PebbleVersionInfo {
	toolVersion: string | null;
	sdkVersion: string | null;
}

export async function getPebbleVersionInfo(): Promise<PebbleVersionInfo> {
	try {
		const { stdout } = await execAsync('pebble --version');
		// Parse output like "Pebble Tool v5.0.5 (active SDK: v4.9.9)" or just "Pebble Tool v5.0.5"
		const toolVersionMatch = stdout.match(/Pebble Tool v([\d.]+)/);
		const sdkVersionMatch = stdout.match(/active SDK: v([\d.]+)/);
		
		const versionInfo = {
			toolVersion: toolVersionMatch ? toolVersionMatch[1] : null,
			sdkVersion: sdkVersionMatch ? sdkVersionMatch[1] : null
		};
		
		console.log(`Pebble Tool version: ${versionInfo.toolVersion || 'not found'}, SDK version: ${versionInfo.sdkVersion || 'not installed'}`);
		
		return versionInfo;
	} catch (error) {
		// If pebble command doesn't exist or fails
		console.log('Pebble Tool not found');
		return {
			toolVersion: null,
			sdkVersion: null
		};
	}
}

export async function isPebbleSdkInstalled(): Promise<boolean> {
	const versionInfo = await getPebbleVersionInfo();
	// SDK is installed if we have an SDK version
	return versionInfo.sdkVersion !== null;
}
