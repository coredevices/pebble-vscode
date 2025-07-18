import * as vscode from 'vscode';
import { getWorkspacePath } from './utils';

export async function getEmulatorPlatform() {
	const defaultPlatform = vscode.workspace.getConfiguration('pebble').get<string>('defaultPlatform');

	if (defaultPlatform) {
		return defaultPlatform;
	}
	
	const platform = await requestEmulatorPlatform();
	if (!platform) {
		return;
	}

	const setDefault = await vscode.window.showQuickPick(['No', 'Yes'], {
		placeHolder: 'Set this platform as the default for future runs?',
		canPickMany: false,
	});

	if (setDefault === 'Yes') {
		const config = vscode.workspace.getConfiguration('pebble');
		await config.update('defaultPlatform', platform, vscode.ConfigurationTarget.Global);
	}

	return platform;
}

export async function requestEmulatorPlatform() {
	const platformMap: { [key: string] : string } = {
		'Pebble Classic': 'aplite',
		'Pebble Time': 'basalt',
		'Pebble Time Round': 'chalk',
		'Pebble 2': 'diorite',
		'Pebble Time 2': 'emery',
	};

	const platformName = await vscode.window.showQuickPick(Object.keys(platformMap), {
		placeHolder: 'Select a platform to emulate',
		canPickMany: false,
	});
	
	if (!platformName) {
		return;
	}

	const platform = platformMap[platformName];
	return platform;
}

export async function runWithArgs(args = '') {
    const platform = await getEmulatorPlatform();
    if (!platform) {
        return;
    }

    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder is open. Please open a workspace folder to run the project.');
        return;
    }

    let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
    if (!terminal) {
        terminal = vscode.window.createTerminal(`Pebble Run`);
    }

    terminal.show();
    terminal.sendText('\x03'); // Send Ctrl+C
    terminal.sendText(`pebble build && pebble install --emulator ${platform}${args ? ' ' + args : ''}`, true);
}

export async function getPhoneIp() {

    const storedPhoneIp = vscode.workspace.getConfiguration('pebble').get<string>('phoneIp');
    if (storedPhoneIp) {
        return storedPhoneIp;
    }

    const phoneIp = await requestPhoneIp();
    if (!phoneIp) {
        return;
    }

    const setDefault = await vscode.window.showQuickPick(['No', 'Yes'], {
        placeHolder: 'Set this IP as the default for future runs?',
        canPickMany: false,
    });

    if (setDefault === 'Yes') {
        const config = vscode.workspace.getConfiguration('pebble');
        await config.update('phoneIp', phoneIp, vscode.ConfigurationTarget.Global);
    }

    return phoneIp;
};

export async function requestPhoneIp() {
    const phoneIp = await vscode.window.showInputBox({
        prompt: 'Enter the IP address of phone. Find it in developer settings on your Pebble app.'
    });

    return phoneIp;
}

export async function runOnPhoneWithArgs(args = '') {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder is open. Please open a workspace folder to run the project.');
        return;
    }

    const phoneIp = await getPhoneIp();
    if (!phoneIp) {
        return;
    }

    let terminal = vscode.window.terminals.find(t => t.name === `Pebble Run`);
    if (!terminal) {
        terminal = vscode.window.createTerminal(`Pebble Run`);
    }

    terminal.show();
    terminal.sendText('\x03'); // Send Ctrl+C
    terminal.sendText(`pebble build && pebble install --phone ${phoneIp}${args ? ' ' + args : ''}`, true);
}