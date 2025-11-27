import * as vscode from 'vscode';
export class PebbleEmulationActionsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    actions: vscode.TreeItem[];

    private createItem(label: string, commandId: string): vscode.TreeItem {
        let item = new vscode.TreeItem(label);
        item.command = {
            command: commandId,
            title: label
        };
        return item; 
    }

    constructor() {
        this.actions = [
            this.createItem('Display App Config', 'pebble.openEmulatorAppConfig'),
            this.createItem('Change Battery Level & Charging State', 'pebble.emuBatteryState'),
            this.createItem('Change Bluetooth Connection State', 'pebble.emuBluetoothState'),
            this.createItem('Emulates Tap', 'pebble.emuTap'),
            this.createItem('Sets Time Format (12h or 24h)', 'pebble.emuTimeFormat'),
            this.createItem('Change Timeline Quick View State', 'pebble.emuTimelineQuickView'),
        ];
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!element) {
            // Return the root items
            return this.actions;
        }
        
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