"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const noteEditor_1 = require("./noteEditor");
function activate(context) {
    // Register the custom editor provider
    const provider = new noteEditor_1.NoteEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider('richNotes.noteEditor', provider);
    // Register the create note command
    const createNoteCommand = vscode.commands.registerCommand('richNotes.createNote', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a workspace folder first');
            return;
        }
        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter note name',
            value: 'new-note.note'
        });
        if (fileName) {
            const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
            const initialContent = JSON.stringify({
                content: '<p>Start typing your note here...</p>',
                images: {}
            }, null, 2);
            await vscode.workspace.fs.writeFile(filePath, Buffer.from(initialContent));
            await vscode.window.showTextDocument(filePath);
        }
    });
    context.subscriptions.push(providerRegistration, createNoteCommand);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map