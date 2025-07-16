import * as vscode from 'vscode';

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