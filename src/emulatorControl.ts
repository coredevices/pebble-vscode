import * as vscode from 'vscode';
import { getWorkspacePath, getPebbleVersionInfo, isVersionBelow, upgradePebbleTool, isDevContainer } from './utils';
import { getEmulatorPlatform } from './run';
import { isFloat32Array } from 'util/types';


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
        vscode.window.showErrorMessage('Unavailable inside DevContainer/Codespaces');
        return;
    }

    terminal.show();
    terminal.sendText('\x03'); // Send Ctrl+C

    terminal.sendText(`pebble emu-app-config --emulator ${platform} --vnc`, true);
}

export async function emulatorBatterySetState() {
    console.log('emulatorBatterySetState called');

    const platform = await getEmulatorPlatform();
    if (!platform) {
        console.log('No platform selected, returning early');
        return;
    }
    console.log('Platform selected:', platform);

    const batteryStateStr = await vscode.window.showInputBox({
        placeHolder: 'Enter a battery percentage between 0 and 100.',
    });
    if (!batteryStateStr) {
        return;
    }
    const batteryState = Number(batteryStateStr).valueOf();
    if (isNaN(batteryState) || batteryState < 0 || batteryState > 100) {
        vscode.window.showErrorMessage('Please enter an integer between 0 and 100');
        return;
    }
    
    let batteryStateStrSubstring = batteryStateStr;
    if (batteryState < 10) {
        batteryStateStrSubstring = batteryStateStr.substring(0, 1);
    } else if (batteryState < 100) {
        batteryStateStrSubstring = batteryStateStr.substring(0, 2);
    } else {
        batteryStateStrSubstring = batteryStateStr.substring(0, 3);
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

    terminal.sendText(`pebble emu-battery --emulator ${platform} --vnc --percent ${batteryStateStrSubstring} ${charging ? '--charging' : ''}`);
}

export async function emulatorBluetoothSetState() {
    console.log('emulatorBluetoothSetState called');

    const platform = await getEmulatorPlatform();
    if (!platform) {
        console.log('No platform selected, returning early');
        return;
    }
    console.log('Platform selected:', platform);

    const connectedMap: {[key: string] : boolean } = {
        'Active': true,
        'Inactive': false
    };

    const connectedChoice = await vscode.window.showQuickPick(Object.keys(connectedMap), {
        placeHolder: 'Set the bluetooth connection',
        canPickMany: false,
    });

    if (!connectedChoice) {
        return;
    }

    const connected = connectedMap[connectedChoice];

    // Checking if the emulator is currently running : TODO ?
    let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
    if (!terminal) {
        vscode.window.showErrorMessage('Please first run the project and keep the terminal open');
        return;
    }

    terminal.show();

    terminal.sendText(`pebble emu-bt-connection --emulator ${platform} --vnc --connected ${connected ? 'yes' : 'no'}`);
}

export async function emulatorAccelTapTrigger() {
    console.log('emulatorAccelTapTrigger called');

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

    terminal.show();

    terminal.sendText(`pebble emu-tap --emulator ${platform} --vnc --direction y+`);
}

export async function emulatorSetTimeFormat() {
    console.log('emulatorSetTimeFormat called');

    const platform = await getEmulatorPlatform();
    if (!platform) {
        console.log('No platform selected, returning early');
        return;
    }
    console.log('Platform selected:', platform);

    const timeFormatChoice = await vscode.window.showQuickPick(['12h', '24h'], {
        placeHolder: 'Select Time Format',
        canPickMany: false,
    });

    if (!timeFormatChoice) {
        return;
    }

    // Checking if the emulator is currently running : TODO ?
    let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
    if (!terminal) {
        vscode.window.showErrorMessage('Please first run the project and keep the terminal open');
        return;
    }

    terminal.show();

    terminal.sendText(`pebble emu-time-format --emulator ${platform} --vnc --format ${timeFormatChoice}`);
}

export async function emulatorTimelineQuickViewSet() {
    console.log('emulatorTimelineQuickViewSet called');

    const platform = await getEmulatorPlatform();
    if (!platform) {
        console.log('No platform selected, returning early');
        return;
    }
    console.log('Platform selected:', platform);

    const quickViewStateMap: {[key: string] : boolean } = {
        'Active': true,
        'Inactive': false
    };

    const quickViewStateChoice = await vscode.window.showQuickPick(Object.keys(quickViewStateMap), {
        placeHolder: 'Set the timeline quick view state',
        canPickMany: false,
    });

    if (!quickViewStateChoice) {
        return;
    }

    const quickViewState = quickViewStateMap[quickViewStateChoice];

    // Checking if the emulator is currently running : TODO ?
    let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
    if (!terminal) {
        vscode.window.showErrorMessage('Please first run the project and keep the terminal open');
        return;
    }

    terminal.show();

    terminal.sendText(`pebble emu-set-timeline-quick-view --emulator ${platform} --vnc ${quickViewState ? 'on' : 'off'}`);
}