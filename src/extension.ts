import * as vscode from 'vscode';
import { CerebrasChatModelProvider } from './provider';

export function activate(context: vscode.ExtensionContext) {
	const provider = new CerebrasChatModelProvider(context);
	vscode.lm.registerLanguageModelChatProvider('cerebras', provider);
	vscode.commands.registerCommand('cerebras-chat.manageApiKey', async () => {
		await provider.setApiKey();
	});
}

export function deactivate() { }
