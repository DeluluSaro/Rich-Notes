import * as vscode from 'vscode';
import * as path from 'path';

export class NoteEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new NoteEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider('richNotes.noteEditor', provider);
        return providerRegistration;
    }

    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.file(path.dirname(document.uri.fsPath)),
                // Allow access to workspace images folder
                vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0]?.uri || document.uri, 'images')
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            console.log('Received message:', message.type);
            switch (message.type) {
                case 'save':
                    await this.updateTextDocument(document, message.content);
                    vscode.window.showInformationMessage('Note saved successfully!');
                    break;
                case 'insertImage':
                    await this.handleInsertImage(webviewPanel.webview, document);
                    break;
                case 'pasteImage':
                    await this.handlePasteImage(webviewPanel.webview, document, message.imageData);
                    break;
                case 'ready':
                    // Send initial content when webview is ready
                    await this.sendContentToWebview(webviewPanel.webview, document);
                    break;
            }
        });

        // Update webview when document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                this.sendContentToWebview(webviewPanel.webview, document);
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Send initial content
        await this.sendContentToWebview(webviewPanel.webview, document);
    }

    private async sendContentToWebview(webview: vscode.Webview, document: vscode.TextDocument) {
        const content = this.getDocumentAsJson(document);
        
        // Convert local image paths to webview URIs for display in VS Code
        if (content.content) {
            content.content = await this.processImageSrcsForWebview(content.content, webview, document);
        }
        
        webview.postMessage({
            type: 'update',
            content: content
        });
    }

    private async processImageSrcsForWebview(htmlContent: string, webview: vscode.Webview, document: vscode.TextDocument): Promise<string> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) return htmlContent;

        // Replace relative image paths with webview URIs
        return htmlContent.replace(/src="\.?\/images\/([^"]+)"/g, (match, filename) => {
            const imagePath = vscode.Uri.joinPath(workspaceFolder.uri, 'images', filename);
            const webviewUri = webview.asWebviewUri(imagePath);
            return `src="${webviewUri.toString()}"`;
        });
    }

    private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editor.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editor.css'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: https: file:;">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Rich Note Editor</title>
        </head>
        <body>
            <div class="toolbar">
                <button id="bold-btn" title="Bold"><strong>B</strong></button>
                <button id="italic-btn" title="Italic"><em>I</em></button>
                <button id="underline-btn" title="Underline"><u>U</u></button>
                <button id="image-btn" title="Insert Image">🖼️</button>
                <button id="save-btn" title="Save (Ctrl+S)">💾</button>
            </div>
            <div id="editor" contenteditable="true" spellcheck="false"></div>
            <div id="status"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private async handleInsertImage(webview: vscode.Webview, document: vscode.TextDocument) {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Select Image',
            filters: {
                'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp']
            }
        };

        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            const imageName = await this.copyImageToWorkspace(fileUri[0], document);
            if (imageName) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                if (workspaceFolder) {
                    const imagePath = vscode.Uri.joinPath(workspaceFolder.uri, 'images', imageName);
                    const imageUri = webview.asWebviewUri(imagePath);
                    
                    webview.postMessage({
                        type: 'insertImage',
                        imageUri: imageUri.toString(),
                        imagePath: imageName,
                        relativePath: `images/${imageName}` // Store relative path for GitHub compatibility
                    });
                }
            }
        }
    }

    private async handlePasteImage(webview: vscode.Webview, document: vscode.TextDocument, imageData: string) {
        try {
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            // Create images directory if it doesn't exist
            const imagesDir = vscode.Uri.joinPath(workspaceFolder.uri, 'images');
            try {
                await vscode.workspace.fs.createDirectory(imagesDir);
            } catch (error) {
                // Directory might already exist, that's okay
            }

            // Generate unique filename
            const timestamp = Date.now();
            const fileName = `pasted-${timestamp}.png`;
            const imagePath = vscode.Uri.joinPath(imagesDir, fileName);
            
            // Save the image file
            await vscode.workspace.fs.writeFile(imagePath, buffer);
            
            // Get webview URI for immediate display
            const imageUri = webview.asWebviewUri(imagePath);
            
            webview.postMessage({
                type: 'insertImage',
                imageUri: imageUri.toString(),
                imagePath: fileName,
                relativePath: `images/${fileName}` // Store relative path for GitHub compatibility
            });

            vscode.window.showInformationMessage(`Image saved as ${fileName}`);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to paste image: ' + error);
        }
    }

    private async copyImageToWorkspace(sourceUri: vscode.Uri, document: vscode.TextDocument): Promise<string | null> {
        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return null;
            }

            // Create images directory if it doesn't exist
            const imagesDir = vscode.Uri.joinPath(workspaceFolder.uri, 'images');
            try {
                await vscode.workspace.fs.createDirectory(imagesDir);
            } catch (error) {
                // Directory might already exist, that's okay
            }

            const originalFileName = path.basename(sourceUri.fsPath);
            const timestamp = Date.now();
            const fileName = `${timestamp}-${originalFileName}`;
            const destPath = vscode.Uri.joinPath(imagesDir, fileName);
            
            // Copy the image to workspace
            await vscode.workspace.fs.copy(sourceUri, destPath, { overwrite: true });
            
            vscode.window.showInformationMessage(`Image copied as ${fileName}`);
            return fileName;
        } catch (error) {
            vscode.window.showErrorMessage('Failed to copy image: ' + error);
            return null;
        }
    }

    private getDocumentAsJson(document: vscode.TextDocument): any {
        const text = document.getText();
        if (text.trim().length === 0) {
            return { content: '<p></p>', images: {} };
        }

        try {
            return JSON.parse(text);
        } catch {
            return { content: text, images: {} };
        }
    }

    private updateTextDocument(document: vscode.TextDocument, content: any): Thenable<boolean> {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        
        // Ensure we're saving with relative paths for GitHub compatibility
        if (content.content) {
            content.content = this.convertWebviewUrisToRelativePaths(content.content);
        }
        
        edit.replace(document.uri, fullRange, JSON.stringify(content, null, 2));
        return vscode.workspace.applyEdit(edit);
    }

    private convertWebviewUrisToRelativePaths(htmlContent: string): string {
        // Convert webview URIs to GitHub-compatible relative paths
        return htmlContent.replace(
            /src="[^"]*\/images\/([^"]+)"/g, 
            'src="./images/$1"'  // Add ./ prefix for GitHub compatibility
        );
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}