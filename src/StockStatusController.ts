import * as vscode from 'vscode';
import { MESSAGES } from './constants';
import { StockManager } from './managers/StockManager';
import { StockRenderer } from './renderers/StockRenderer';
import { StockTimer } from './timers/StockTimer';
import { StockQuickPickItem } from './vscode/StockQuickPickItem';

export default class StockStatusController {
	private stockManager = new StockManager();
	private stockTimer = new StockTimer();
	private stockRenderer = new StockRenderer();
	private quickPick = this.createQuickPick();

	constructor() {
		this.stockTimer.setCallback(this.ticker.bind(this));
	}

	private createQuickPick(): vscode.QuickPick<StockQuickPickItem> {
		const picker = vscode.window.createQuickPick<StockQuickPickItem>();
		picker.canSelectMany = false;
		picker.matchOnDescription = true;
		picker.matchOnDetail = true;
		picker.onDidAccept(() => {
			const item = picker.selectedItems[0];
			if (!picker.busy) {
				item?.action();
			}
		});
		return picker;
	}

	private async ticker(): Promise<void> {
		await this.stockManager.fetchStockData();
		this.stockRenderer.render(this.stockManager.getStocks());
	}

	private openQuickPick(items: StockQuickPickItem[], title = ''): void {
		this.quickPick.busy = false;
		this.quickPick.value = '';
		this.quickPick.items = items;
		this.quickPick.placeholder = title;
		this.quickPick.show();
	}

	private async searchStocks(query: string): Promise<void> {
		const stock = await this.stockManager.searchStock(query);
		const selectionItems: StockQuickPickItem[] = [];

		if (stock) {
			selectionItems.push({
				label: stock.name || '',
				action: () => this.handleStockSelection(stock),
			});
		} else {
			selectionItems.push({
				label: '결과 없음',
				action: () => {
					// No operation
				},
			});
		}

		selectionItems.push({
			label: '돌아가기',
			action: () => this.openSearch(),
		});

		this.openQuickPick(selectionItems);
	}

	private async handleStockSelection(stock: any): Promise<void> {
		if (!stock.isValid()) {
			vscode.window.showErrorMessage(MESSAGES.STOCK_NOT_FOUND);
			return;
		}

		const added = await this.stockManager.addStock(stock.code, stock.name);
		if (added) {
			this.quickPick.hide();
			this.restart();
		}
	}

	private async openSearch(): Promise<void> {
		const input = await vscode.window.showInputBox({
			prompt: '한국 주식 코드(숫자만)를 입력해주세요. ex)005930(삼성전자)',
			placeHolder: '주식 코드 ex)005930',
		});

		if (input?.trim()) {
			await this.searchStocks(input.trim());
		}
	}

	public restart(): void {
		this.stockManager.loadStocks();
		this.stockTimer.start();
	}

	public stop(): void {
		this.stockTimer.stop();
		this.stockRenderer.stopAllRender();
	}

	public registerCommands(context: vscode.ExtensionContext): void {
		context.subscriptions.push(
			vscode.commands.registerCommand('stockStatus.start', () =>
				this.restart(),
			),
			vscode.commands.registerCommand('stockStatus.stop', () => this.stop()),
			vscode.commands.registerCommand('stockStatus.add', () =>
				this.openSearch(),
			),
			vscode.workspace.onDidChangeConfiguration(() => {
				if (this.stockTimer.isRunning()) this.restart();
			}),
		);

		this.restart();
	}

	public dispose(): void {
		this.stop();
		this.quickPick.dispose();
	}
}
