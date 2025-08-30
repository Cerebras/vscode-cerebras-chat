import * as vscode from 'vscode';
import { CerebrasChatModelProvider } from './provider';

export function activate(context: vscode.ExtensionContext) {
	vscode.lm.registerLanguageModelChatProvider('cerebras', new CerebrasChatModelProvider(context));
}

export function deactivate() { }
