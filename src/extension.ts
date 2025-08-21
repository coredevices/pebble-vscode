import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PebbleTreeProvider } from './pebbleTreeProvider';
import { requestEmulatorPlatform, runOnEmulatorWithArgs, requestPhoneIp, runOnPhoneWithArgs, wipeEmulator } from './run';
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
			padding: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
        }
        
        #screen {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--vscode-editor-background);
        }
        
        #screen > div {
            background: var(--vscode-editor-background) !important;
        }
        
        #screen canvas {
            cursor: default !important;
        }
        
        #status {
            position: fixed;
            top: 10px;
            left: 10px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            border: 1px solid var(--vscode-panel-border);
            padding: 10px 15px;
            border-radius: 4px;
            max-width: 400px;
            font-size: var(--vscode-editor-font-size);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .error { color: var(--vscode-editorError-foreground); }
        .success { color: var(--vscode-terminal-ansiGreen); }
        .info { color: var(--vscode-editorInfo-foreground); }
        
        .control-button {
            position: absolute;
            background: #6b6b6b;
            border: 1px solid #4a4a4a;
            border-radius: 4px;
            cursor: pointer;
            user-select: none;
            transition: all 0.2s;
            z-index: 1000;
        }
        
        .control-button:hover {
            background: #7b7b7b;
        }
        
        .control-button:active {
            background: #5b5b5b;
            transform: scale(0.98);
        }
        
        #button-container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }
        
        #button-container .control-button {
            pointer-events: auto;
        }
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
        const maxRetries = 30; // 30 retries * 1 second = 30 seconds max
        
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
                    
                    // Add control buttons after connection
                    setTimeout(() => {
                        const canvas = document.querySelector('#screen canvas');
                        if (!canvas) return;
                        
                        const container = canvas.parentElement;
                        if (!container || document.getElementById('button-container')) return;
                        
                        const buttonContainer = document.createElement('div');
                        buttonContainer.id = 'button-container';
                        buttonContainer.style.width = canvas.offsetWidth + 'px';
                        buttonContainer.style.height = canvas.offsetHeight + 'px';
                        
                        // Calculate button dimensions dynamically
                        const canvasHeight = canvas.offsetHeight;
                        const buttonWidth = 25;
                        const spacing = 8;
                        const buttonHeight = (canvasHeight - (spacing * 2)) / 3;
                        
                        // Button configuration
                        const buttonConfig = [
                            { id: 'btn-left', key: 'ArrowLeft', side: 'left', position: 0.5 },
                            { id: 'btn-up', key: 'ArrowUp', side: 'right', position: 0 },
                            { id: 'btn-select', key: 'ArrowRight', side: 'right', position: 1 },
                            { id: 'btn-down', key: 'ArrowDown', side: 'right', position: 2 }
                        ];
                        
                        // Create and position buttons
                        const buttons = buttonConfig.map(config => {
                            const btn = document.createElement('button');
                            btn.id = config.id;
                            btn.className = 'control-button';
                            btn.setAttribute('data-key', config.key);
                            
                            // Set dimensions
                            btn.style.width = buttonWidth + 'px';
                            btn.style.height = buttonHeight + 'px';
                            
                            // Position based on side
                            if (config.side === 'left') {
                                btn.style.left = '-' + buttonWidth + 'px';
                                btn.style.top = '50%';
                                btn.style.transform = 'translateY(-50%)';
                            } else {
                                btn.style.right = '-' + buttonWidth + 'px';
                                btn.style.top = ((buttonHeight + spacing) * config.position) + 'px';
                            }
                            
                            buttonContainer.appendChild(btn);
                            return btn;
                        });
                        
                        container.appendChild(buttonContainer);
                        
                        // Add event handlers
                        buttons.forEach(button => {
                            button.addEventListener('click', () => {
                                if (!rfb) return;
                                
                                const key = button.getAttribute('data-key');
                                const keysym = keyMap[key];
                                if (keysym) {
                                    rfb.sendKey(keysym, null, true);
                                    setTimeout(() => rfb.sendKey(keysym, null, false), 100);
                                }
                            });
                            
                            button.addEventListener('contextmenu', e => e.preventDefault());
                        });
                    }, 100);
                });
                
                rfb.addEventListener('disconnect', (e) => {
                    status.style.display = 'block';
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setStatus('Waiting for emulator...', 'info');
                        setTimeout(connect, 1000);
                    } else {
                        setStatus(\`Disconnected: \${e.detail.reason || 'Connection lost'}\`, 'error');
                    }
                });
                
                rfb.addEventListener('securityfailure', (e) => {
                    setStatus(\`Security error: \${e.detail.reason}\`, 'error');
                });
                
                // Keyboard handling
                const keyMap = {
                    'ArrowLeft': 0xFF51,
                    'ArrowUp': 0xFF52,
                    'ArrowRight': 0xFF53,
                    'ArrowDown': 0xFF54,
                    'q': 113, 'w': 119, 's': 115, 'x': 120
                };
                
                document.onkeydown = (e) => {
                    if (!rfb) return;
                    
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

	const wipeEmulatorCommand = vscode.commands.registerCommand('pebble.wipeEmulator', async () => {
		wipeEmulator();
	});

	const downloadPbwCommand = vscode.commands.registerCommand('pebble.downloadPbw', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder is open');
			return;
		}

		const workspacePath = workspaceFolders[0].uri.fsPath;
		
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Building PBW...",
			cancellable: false
		}, async () => {
			const { exec } = require('child_process');
			const { promisify } = require('util');
			const execAsync = promisify(exec);
			
			try {
				// Build the project
				await execAsync('pebble build', { cwd: workspacePath });
				
				// Find the .pbw file in build directory
				const buildPath = path.join(workspacePath, 'build');
				const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(buildPath));
				const pbwFile = files.find(([name]) => name.endsWith('.pbw'));
				
				if (!pbwFile) {
					vscode.window.showErrorMessage('No PBW file found in build directory');
					return;
				}
				
				const pbwPath = path.join(buildPath, pbwFile[0]);
				
				// Codespace: trigger browser download. Desktop: ask where to save.
				if (process.env.CODESPACES === 'true') {
					const pbwContent = await vscode.workspace.fs.readFile(vscode.Uri.file(pbwPath));
					const base64 = Buffer.from(pbwContent).toString('base64');
					await vscode.env.openExternal(vscode.Uri.parse(`data:application/octet-stream;base64,${base64}`));
				} else {
					const saveUri = await vscode.window.showSaveDialog({
						defaultUri: vscode.Uri.file(path.join(require('os').homedir(), 'Downloads', pbwFile[0])),
						filters: { 'Pebble App': ['pbw'] }
					});
					if (!saveUri) {
						return;
					}
					
					// Copy the file to the chosen location
					await vscode.workspace.fs.copy(
						vscode.Uri.file(pbwPath),
						saveUri,
						{ overwrite: true }
					);
					vscode.window.showInformationMessage(`PBW file saved to ${path.basename(saveUri.fsPath)}`);
				}
			} catch (error: any) {
				// Display the error message from the build
				vscode.window.showErrorMessage(`Build failed: ${error.message}`);
			}
		});
	});

	const downloadZipCommand = vscode.commands.registerCommand('pebble.downloadZip', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder is open');
			return;
		}

		const workspacePath = workspaceFolders[0].uri.fsPath;
		const workspaceName = path.basename(workspacePath);
		
		// Codespace: use temp directory. Desktop: ask where to save.
		let zipPath: string;
		if (process.env.CODESPACES === 'true') {
			zipPath = path.join(require('os').tmpdir(), `${workspaceName}.zip`);
		} else {
			const saveUri = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(path.join(require('os').homedir(), 'Downloads', `${workspaceName}.zip`)),
				filters: { 'ZIP Files': ['zip'] }
			});
			if (!saveUri) {
				return;
			}
			zipPath = saveUri.fsPath;
		}
		
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Creating ZIP file...",
			cancellable: false
		}, async () => {
			const { exec } = require('child_process');
			const { promisify } = require('util');
			const execAsync = promisify(exec);
			
			try {
				await execAsync(`cd "${workspacePath}" && zip -r "${zipPath}" .`);
				
				// Codespace: trigger browser download. Desktop: show success message.
				if (process.env.CODESPACES === 'true') {
					const zipContent = await vscode.workspace.fs.readFile(vscode.Uri.file(zipPath));
					const base64 = Buffer.from(zipContent).toString('base64');
					await vscode.env.openExternal(vscode.Uri.parse(`data:application/zip;base64,${base64}`));
					await vscode.workspace.fs.delete(vscode.Uri.file(zipPath));
				} else {
					vscode.window.showInformationMessage(`ZIP file saved to ${path.basename(zipPath)}`);
				}
			} catch (error: any) {
				vscode.window.showErrorMessage(`Failed to create ZIP: ${error.message}`);
			}
		});
	});

	const treeDataProvider = new PebbleTreeProvider();
	const treeView = vscode.window.createTreeView('backgroundTreeView', {
		treeDataProvider: treeDataProvider
	});

	context.subscriptions.push(newProjectDisposable, openProjectDisposable, run, runWithLogs, setDefaultPlatform, runOnPhone, runOnPhoneWithLogs, setPhoneIp, wipeEmulatorCommand, downloadPbwCommand, downloadZipCommand, treeView, showSidebarPreview, showEditorPreviewCommand);
}

export function deactivate() {}