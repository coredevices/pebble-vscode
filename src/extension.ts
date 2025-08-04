import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PebbleTreeProvider } from './pebbleTreeProvider';
import { requestEmulatorPlatform, runOnEmulatorWithArgs, requestPhoneIp, runOnPhoneWithArgs } from './run';
import { createProject, openProject } from './project';
import { isPebbleProject } from './utils';

class PebblePreviewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'pebblePreviewSidebar';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
	}

	public show() {
		if (this._view) {
			this._view.show?.(true);
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to the webview HTML
		const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview.html');
		const htmlContent = fs.readFileSync(htmlPath, 'utf8');
		return htmlContent;
	}
}

export async function activate(context: vscode.ExtensionContext) {
	console.log('Pebble extension activated');

	let webviewPanel: vscode.WebviewPanel | undefined;

	// Register the webview view provider for sidebar
	const sidebarProvider = new PebblePreviewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(PebblePreviewProvider.viewType, sidebarProvider)
	);

	// Helper function to create or show the preview panel
	function createOrShowPreview() {
		// Show compact sidebar preview by default (saves space)
		sidebarProvider.show();
		
		// Note: Users can manually open the full editor preview using 
		// "Pebble: Show Editor Preview" command if they want the larger view
	}

	if (await isPebbleProject()) {
		vscode.commands.executeCommand('setContext', 'pebbleProject', true);
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
		createOrShowPreview();
		runOnEmulatorWithArgs();
	});

	const runWithLogs = vscode.commands.registerCommand('pebble.runEmulatorLogs', async () => {
		createOrShowPreview();
		runOnEmulatorWithArgs('--logs');
	});

	// Additional commands for controlling preview views
	const showSidebarPreview = vscode.commands.registerCommand('pebble.showSidebarPreview', () => {
		sidebarProvider.show();
	});

	const showEditorPreview = vscode.commands.registerCommand('pebble.showEditorPreview', () => {
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

			// Lock the panel whenever it becomes visible and active (after being dragged, etc.)
			webviewPanel.onDidChangeViewState(e => {
				if (e.webviewPanel.visible && e.webviewPanel.active) {
					// Small delay to ensure the panel is fully rendered
					setTimeout(() => {
						vscode.commands.executeCommand('workbench.action.lockEditorGroup');
					}, 50);
				}
			});

			// Initial lock on creation (needed when opened via command palette)
			setTimeout(() => {
				vscode.commands.executeCommand('workbench.action.lockEditorGroup');
			}, 50);
		} else {
			webviewPanel.reveal(vscode.ViewColumn.Two, true);
		}
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

	context.subscriptions.push(newProjectDisposable, openProjectDisposable, run, runWithLogs, setDefaultPlatform, runOnPhone, runOnPhoneWithLogs, setPhoneIp, treeView, showSidebarPreview, showEditorPreview);
}

export function deactivate() {}