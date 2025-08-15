import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PebbleTreeProvider } from './pebbleTreeProvider';
import { requestEmulatorPlatform, runOnEmulatorWithArgs, requestPhoneIp, runOnPhoneWithArgs } from './run';
import { createProject, openProject } from './project';
import { isPebbleProject } from './utils';

class PebblePreviewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'pebbleEmulatorSidebar';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	public async resolveWebviewView(
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

		webviewView.webview.html = await getWebviewContent();
	}

	public show() {
		if (this._view) {
			this._view.show?.(true);
		}
	}
	
	public isVisible(): boolean {
		return this._view?.visible === true;
	}
}

async function getWebviewContent() {
	// Make the QEMU VNC port public if running in a GitHub Codespace
	if (process.env.CODESPACES === 'true' && process.env.CODESPACE_NAME) {
		const { exec } = require('child_process');
		exec(`gh codespace ports visibility 6080:public -c ${process.env.CODESPACE_NAME}`, (error: any) => {
			if (error) {
				vscode.window.showErrorMessage(`Failed to make port 6080 public: ${error}`);
			}
		});
	}

	const fullUri = await vscode.env.asExternalUri(
		vscode.Uri.parse("http://localhost:6080/")
	)
	
	// Convert to WebSocket URL
	const wsUrl = fullUri.toString()
		.replace(/^https:/, 'wss:')
		.replace(/^http:/, 'ws:');

	

	return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>VNC Viewer</title>
    <style>
        body {
            margin: 0;
            background: #222;
            color: #fff;
            font-family: monospace;
        }
        
        #screen {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
        }
        
        #screen canvas {
            cursor: default !important;
        }
        
        #status {
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            padding: 10px;
            border-radius: 5px;
            max-width: 400px;
        }
        
        .error { color: #ff6b6b; }
        .success { color: #51cf66; }
        .info { color: #74c0fc; }
    </style>
</head>
<body>
    <div id="status">Connecting to VNC...</div>
    <div id="screen"></div>
    
    <script type="module">
        import RFB from 'https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/core/rfb.js';
        
        const status = document.getElementById('status');
        const screen = document.getElementById('screen');
        
        let rfb = null;
        let retryCount = 0;
        const maxRetries = 30; // 30 retries * 2 seconds = 1 minute max
        
        function setStatus(msg, type = 'info') {
            status.className = type;
            status.textContent = msg;
        }
        
        function connect() {
            try {
                rfb = new RFB(screen, '${wsUrl}');
                
                rfb.addEventListener('connect', () => {
                    setStatus('Connected! Use arrow keys or Q/W/S/X', 'success');
                    rfb.focus();
                    retryCount = 0; // Reset counter on successful connection
                    setTimeout(() => status.style.display = 'none', 3000);
                });
                
                rfb.addEventListener('disconnect', (e) => {
                    status.style.display = 'block';
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setStatus('Waiting for emulator...', 'info');
                        setTimeout(connect, 2000);
                    } else {
                        setStatus(\`Disconnected: \${e.detail.reason || 'Connection lost'}\`, 'error');
                    }
                });
                
                rfb.addEventListener('securityfailure', (e) => {
                    setStatus(\`Security error: \${e.detail.reason}\`, 'error');
                });
                
                // Keyboard handling
                document.onkeydown = (e) => {
                    if (!rfb) return;
                    
                    const keyMap = {
                        'ArrowLeft': 0xFF51,
                        'ArrowUp': 0xFF52,
                        'ArrowRight': 0xFF53,
                        'ArrowDown': 0xFF54,
                        'q': 113, 'w': 119, 's': 115, 'x': 120
                    };
                    
                    const keysym = keyMap[e.key];
                    if (keysym) {
                        e.preventDefault();
                        rfb.sendKey(keysym, null, true);
                        setTimeout(() => rfb.sendKey(keysym, null, false), 100);
                    }
                };
                
            } catch (err) {
                setStatus(\`Failed to connect: \${err.message}\`, 'error');
            }
        }
        
        // Start connection
        connect();
    </script>
</body>
</html>`;
	}

export async function activate(context: vscode.ExtensionContext) {
	console.log('Pebble extension activated');

	let webviewPanel: vscode.WebviewPanel | undefined;

	// Register the webview view provider for sidebar
	const sidebarProvider = new PebblePreviewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(PebblePreviewProvider.viewType, sidebarProvider)
	);

	// Helper function to show editor preview
	async function showEditorPreview() {
		if (!webviewPanel || webviewPanel.visible === false) {
			webviewPanel = vscode.window.createWebviewPanel(
				'pebbleEmulator',
				'Pebble Emulator',
				vscode.ViewColumn.Two,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			webviewPanel.webview.html = await getWebviewContent();

			webviewPanel.onDidDispose(() => {
				webviewPanel = undefined;
			});

			// Lock the panel whenever it becomes visible and active
			webviewPanel.onDidChangeViewState(e => {
				if (e.webviewPanel.visible && e.webviewPanel.active) {
					setTimeout(() => {
						vscode.commands.executeCommand('workbench.action.lockEditorGroup');
					}, 50);
				}
			});

			// Initial lock on creation
			setTimeout(() => {
				vscode.commands.executeCommand('workbench.action.lockEditorGroup');
			}, 50);
		} else {
			webviewPanel.reveal(vscode.ViewColumn.Two, true);
		}
	}

	// Helper function to create or show the preview panel
	function createOrShowPreview() {
		// If sidebar view is already visible, don't open editor panel
		if (sidebarProvider.isVisible()) {
			return;
		}
		
		// Otherwise, show editor panel by default
		showEditorPreview();
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

	const showEditorPreviewCommand = vscode.commands.registerCommand('pebble.showEditorPreview', () => {
		showEditorPreview();
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

	context.subscriptions.push(newProjectDisposable, openProjectDisposable, run, runWithLogs, setDefaultPlatform, runOnPhone, runOnPhoneWithLogs, setPhoneIp, treeView, showSidebarPreview, showEditorPreviewCommand);
}

export function deactivate() {}