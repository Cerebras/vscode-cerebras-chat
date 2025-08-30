import * as vscode from 'vscode';
import { CerebrasChatModelProvider } from './provider';

export function activate(_: vscode.ExtensionContext) {
	vscode.lm.registerLanguageModelChatProvider('cerebras', new CerebrasChatModelProvider());
}

export function deactivate() { }
