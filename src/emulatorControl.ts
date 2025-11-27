import * as vscode from 'vscode';
import { getWorkspacePath, getPebbleVersionInfo, isVersionBelow, upgradePebbleTool, isDevContainer } from './utils';
import { getEmulatorPlatform } from './run';


export async function openEmulatorAppConfig() {
    console.log('openEmulatorAppConfig called');

    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder is open. Please open a workspace folder and run the project.');
        return;
    }
    
    const platform = await getEmulatorPlatform();
    if (!platform) {
        console.log('No platform selected, returning early');
        return;
    }
    console.log('Platform selected:', platform);

    // Checking if the emulator is currently running : TODO ?
    let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
    if (!terminal) {
        vscode.window.showErrorMessage('Please first run the project and keep the terminal open');
        return;
    }

    if (isDevContainer()) {
        vscode.window.showErrorMessage('Cannot display emulator app config inside DevContainer/Codespaces for the moment');
        return;
    }

    terminal.show();
    terminal.sendText('\x03'); // Send Ctrl+C

    terminal.sendText(`pebble emu-app-config --emulator ${platform} --vnc`, true);
}

export async function emulatorBatterySetState() {
    const platform = await getEmulatorPlatform();
    if (!platform) {
        console.log('No platform selected, returning early');
        return;
    }
    console.log('Platform selected:', platform);

    const batteryState = await vscode.window.showInputBox({
        valueSelection: [0, 101],
        placeHolder: 'Select a battery state',
    });

    if (!batteryState) {
        return;
    }

    const chargingMap: {[key: string] : boolean } = {
        'Yes': true,
        'No': false
    };

    const chargingChoice = await vscode.window.showQuickPick(Object.keys(chargingMap), {
        placeHolder: 'Is the battery charging?',
        canPickMany: false,
    });

    if (!chargingChoice) {
        return;
    }

    const charging = chargingMap[chargingChoice];

    // Checking if the emulator is currently running : TODO ?
    let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
    if (!terminal) {
        vscode.window.showErrorMessage('Please first run the project and keep the terminal open');
        return;
    }

    terminal.show();

    terminal.sendText(`pebble emu-battery --emulator ${platform} --vnc --percent ${batteryState} ${charging ? '--charging' : ''}`);
}

export async function emulatorBluetoothSetState() {

}

export async function emulatorAccelTapTrigger() {

}

export async function emulatorSetTimeFormat() {

}

export async function emulatorTimelineQuickViewSet() {

}