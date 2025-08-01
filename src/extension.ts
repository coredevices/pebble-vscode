import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PebbleTreeProvider } from './pebbleTreeProvider';
import { requestEmulatorPlatform, runWithArgs, requestPhoneIp, runOnPhoneWithArgs } from './run';
import { createProject, openProject } from './project';
import { isPebbleProject } from './utils';

export async function activate(context: vscode.ExtensionContext) {
	console.log('Pebble extension activated');

	let webviewPanel: vscode.WebviewPanel | undefined;

	if (await isPebbleProject()) {
		vscode.commands.executeCommand('setContext', 'pebbleProject', true);
		
		// Create webview panel when in a Pebble project
		webviewPanel = vscode.window.createWebviewPanel(
			'pebblePreview',
			'Pebble Preview',
			vscode.ViewColumn.Two,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		// Set HTML content
		const htmlPath = path.join(context.extensionPath, 'src', 'webview.html');
		const htmlContent = fs.readFileSync(htmlPath, 'utf8');
		webviewPanel.webview.html = htmlContent;

		// Clean up when panel is closed
		webviewPanel.onDidDispose(() => {
			webviewPanel = undefined;
		});

		// Recreate webview if user opens a file and it's closed
		vscode.workspace.onDidOpenTextDocument(() => {
			if (!webviewPanel || webviewPanel.visible === false) {
				webviewPanel = vscode.window.createWebviewPanel(
					'pebblePreview',
					'Pebble Preview',
					vscode.ViewColumn.Two,
					{
						enableScripts: true,
						retainContextWhenHidden: true
					}
				);
				const htmlPath = path.join(context.extensionPath, 'src', 'webview.html');
				const htmlContent = fs.readFileSync(htmlPath, 'utf8');
				webviewPanel.webview.html = htmlContent;
				webviewPanel.onDidDispose(() => {
					webviewPanel = undefined;
				});
			}
		});
	} else {
		vscode.commands.executeCommand('setContext', 'pebbleProject', false);
	}

	const newProjectDisposable = vscode.commands.registerCommand('pebble.newProject', () => {
		createProject(context);
	});

	const openProjectDisposable = vscode.commands.registerCommand('pebble.openProject', async () => {
		openProject();
	});

	const run = vscode.commands.registerCommand('pebble.runEmulator', async () => {
		runWithArgs();
	});

	const runWithLogs = vscode.commands.registerCommand('pebble.runEmulatorLogs', async () => {
		runWithArgs('--logs');
	});

	const runOnPhone = vscode.commands.registerCommand('pebble.runPhone', async () => {
		runOnPhoneWithArgs();
	});

	const runOnPhoneWithLogs = vscode.commands.registerCommand('pebble.runOnPhoneWithLogs', async () => {
		runOnPhoneWithArgs('--logs');
	});

	const setDefaultPlatform = vscode.commands.registerCommand('pebble.setDefaultPlatform', async () => {
		const platform = await requestEmulatorPlatform();
		if (!platform) {
			return;
		}
		const config = vscode.workspace.getConfiguration('pebble');
		await config.update('defaultPlatform', platform, vscode.ConfigurationTarget.Global);
	});

	const setPhoneIp = vscode.commands.registerCommand('pebble.setPhoneIp', async () => {
		const phoneIp = await requestPhoneIp();
		if (!phoneIp) {
			return;
		}
		const config = vscode.workspace.getConfiguration('pebble');
		await config.update('phoneIp', phoneIp, vscode.ConfigurationTarget.Global);
	});

	const treeDataProvider = new PebbleTreeProvider();
	const treeView = vscode.window.createTreeView('backgroundTreeView', {
		treeDataProvider: treeDataProvider
	});

	context.subscriptions.push(newProjectDisposable, openProjectDisposable, run, runWithLogs, setDefaultPlatform, runOnPhone, runOnPhoneWithLogs, setPhoneIp, treeView);
}

export function deactivate() {}