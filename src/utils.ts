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

	const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
	
	// Check for package.json with 'pebble' key
	const packageJsonUri = vscode.Uri.joinPath(workspaceRoot, 'package.json');
	try {
		const fileContent = await vscode.workspace.fs.readFile(packageJsonUri);
		const packageJson = JSON.parse(fileContent.toString());
		if ('pebble' in packageJson) {
			return true;
		}
	} catch {
		// package.json doesn't exist or can't be parsed, continue to check appinfo.json
	}

	// Check for appinfo.json with 'watchapp' key
	const appinfoJsonUri = vscode.Uri.joinPath(workspaceRoot, 'appinfo.json');
	try {
		const fileContent = await vscode.workspace.fs.readFile(appinfoJsonUri);
		const appinfoJson = JSON.parse(fileContent.toString());
		return 'watchapp' in appinfoJson;
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

export function isVersionBelow(version: string | null, targetMajor: number, targetMinor: number = 0, targetPatch: number = 0): boolean {
	if (!version) {
		return true; // No version means it's "below" any target
	}
	
	const versionParts = version.split('.').map(v => parseInt(v, 10));
	const major = versionParts[0] || 0;
	const minor = versionParts[1] || 0;
	const patch = versionParts[2] || 0;
	
	if (major < targetMajor) return true;
	if (major > targetMajor) return false;
	
	if (minor < targetMinor) return true;
	if (minor > targetMinor) return false;
	
	return patch < targetPatch;
}

export async function upgradePebbleTool(): Promise<boolean> {
	vscode.window.showInformationMessage('Upgrading Pebble Tool');
	
	try {
		const { stdout, stderr } = await execAsync('uv tool upgrade pebble-tool');
		
		// Log output for debugging
		if (stderr) {
			console.log('Pebble Tool upgrade stderr:', stderr);
		}
		if (stdout) {
			console.log('Pebble Tool upgrade stdout:', stdout);
		}
		
		vscode.window.showInformationMessage('Pebble Tool upgraded successfully.');
		return true;
	} catch (error) {
		console.error('Failed to upgrade Pebble Tool:', error);
		vscode.window.showErrorMessage('Failed to upgrade Pebble Tool. Please run "uv tool upgrade pebble-tool" manually.');
		return false;
	}
}
