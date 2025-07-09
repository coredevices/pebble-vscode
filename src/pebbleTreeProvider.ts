import * as vscode from 'vscode';
export class PebbleTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    // Set the TreeView message
    public message: string = 'This is a Pebble Tree View.';

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        // if (!element) {
        //     // Return the root items
        //     return [new vscode.TreeItem('Root Item 1'), new vscode.TreeItem('Root Item 2')];
        // } else {
        //     // Return child items for the given element
        //     return [new vscode.TreeItem('Child Item 1'), new vscode.TreeItem('Child Item 2')];
        // }

        // No children
        return [];
    }

    getParent(element: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem> {
        // Return the parent of the given element
        // For this example, we assume all items are root items, so return undefined
        return undefined;
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        // Return the TreeItem for the given element
        return element;
    }

    resolveTreeItem(item: vscode.TreeItem, element: vscode.TreeItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
        // Resolve the TreeItem if needed
        // For this example, we do not need to resolve anything
        return item;
    }
}