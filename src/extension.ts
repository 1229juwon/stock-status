import * as vscode from 'vscode';
import StockStatusController from './StockStatusController';

let controller: StockStatusController;

export function activate(context: vscode.ExtensionContext): void {
	controller = new StockStatusController();
	controller.registerCommands(context);
}

export function deactivate(): void {
	controller?.dispose();
}
