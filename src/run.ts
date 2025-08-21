import * as vscode from 'vscode';
import { getWorkspacePath, getPebbleVersionInfo, isVersionBelow, upgradePebbleTool, isDevContainer } from './utils';

export async function getEmulatorPlatform() {
	const defaultPlatform = vscode.workspace.getConfiguration('pebble').get<string>('defaultPlatform');

	if (defaultPlatform) {
		return defaultPlatform;
	}
	
	const platform = await requestEmulatorPlatform();
	if (!platform) {
		return;
	}

	// Automatically set as default
	const config = vscode.workspace.getConfiguration('pebble');
	await config.update('defaultPlatform', platform, vscode.ConfigurationTarget.Global);

	return platform;
}

export async function requestEmulatorPlatform() {
	const platformMap: { [key: string] : string } = {
		'Pebble Classic (aplite)': 'aplite',
		'Pebble Time (basalt)': 'basalt',
		'Pebble Time Round (chalk)': 'chalk',
		'Pebble 2 (diorite)': 'diorite',
		'Pebble Time 2 (emery)': 'emery',
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

export async function runOnEmulatorWithArgs(args = '') {
    console.log('runOnEmulatorWithArgs called with args:', args);
    
    // Check Pebble tool and SDK versions
    const versionInfo = await getPebbleVersionInfo();
    console.log('Version info:', versionInfo);
    
    // Automatically upgrade Pebble tool if version is too old for --vnc support
    if (versionInfo.toolVersion && isVersionBelow(versionInfo.toolVersion, 5, 0, 6)) {
        const upgraded = await upgradePebbleTool();
        if (!upgraded) {
            // Upgrade failed, don't continue
            return;
        }
    }
    
    const needsSdkInstall = !versionInfo.sdkVersion || isVersionBelow(versionInfo.sdkVersion, 4, 5, 0);
    
    const platform = await getEmulatorPlatform();
    if (!platform) {
        console.log('No platform selected, returning early');
        return;
    }
    console.log('Platform selected:', platform);

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
    
    // Add timeout wrapper if in devcontainer and using logs
    const timeoutPrefix = (isDevContainer() && args.includes('--logs')) ? 'timeout 30m ' : '';
    
    // Install latest SDK if needed, then build and run
    if (needsSdkInstall) {
        vscode.window.showInformationMessage('Installing the latest Pebble SDK.');
        terminal.sendText(`pebble sdk install latest && pebble build && ${timeoutPrefix}pebble install --emulator ${platform}${args ? ' ' + args : ''} --vnc`, true);
    } else {
        terminal.sendText(`pebble build && ${timeoutPrefix}pebble install --emulator ${platform}${args ? ' ' + args : ''} --vnc`, true);
    }
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
    
    // Add timeout wrapper if in devcontainer and using logs
    const timeoutPrefix = (isDevContainer() && args.includes('--logs')) ? 'timeout 30m ' : '';
    
    terminal.sendText(`pebble build && ${timeoutPrefix}pebble install --phone ${phoneIp}${args ? ' ' + args : ''}`, true);
}

export async function wipeEmulator() {
    const { exec } = require('child_process');
    
    vscode.window.showInformationMessage('Wiping emulator data...');
    
    exec('pebble kill && pebble wipe', (error: any, stdout: string, stderr: string) => {
        if (error) {
            vscode.window.showErrorMessage(`Failed to wipe emulator: ${error.message}`);
            return;
        }
        
        if (stderr && !stdout) {
            vscode.window.showErrorMessage(`Failed to wipe emulator: ${stderr}`);
            return;
        }
        
        vscode.window.showInformationMessage('Emulator data wiped successfully.');
    });
}