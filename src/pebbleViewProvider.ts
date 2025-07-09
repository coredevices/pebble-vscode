import * as vscode from 'vscode';
export class PebbleViewProvider implements vscode.WebviewViewProvider {

    constructor(private readonly _extensionUri: vscode.Uri) {}

    private _view?: vscode.WebviewView;
    
    public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
        <body>
            <h1>Pebble Project</h1>
            <p>Welcome to the Pebble project view!</p>
            <button id="newProjectButton">New Project</button>
        </body>
        </html>`;
    }
}