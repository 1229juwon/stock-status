import * as vscode from 'vscode';
import Configuration from './configuration';
import logger from './logger/logger';
import Stock from './models/stock';
import { stockProvider } from './providers/provider';
import { render, stopAllRender } from './render';
import { StockQuickPickItem } from './vscode/StockQuickPickItem';

export default class StockStatusController {
	private timer: ReturnType<typeof setInterval> | null = null;
	private stocks: Stock[] = [];
	private quickPick = this.createQuickPick();

	constructor() {
		this.stocks = this.loadChoiceStocks();
	}

	/**
	 * 주식이 유효한지 확인
	 */
	private isValidStock(stock: Stock): boolean {
		return !!(stock.name && stock.name !== '---');
	}

	/**
	 * 정규화된 코드로 주식이 이미 존재하는지 확인
	 */
	private stockExists(code: string): boolean {
		const normalizedCode = code.toLowerCase();
		const currentStocks = Configuration.getStocks() || [];
		return currentStocks.some((item) =>
			typeof item === 'string'
				? item.toLowerCase() === normalizedCode
				: item.code.toLowerCase() === normalizedCode,
		);
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

	private loadChoiceStocks(): Stock[] {
		return Configuration.getStocks().map((item) => {
			if (typeof item === 'string') return new Stock(item);
			if (typeof item === 'object')
				return new Stock(item.code, item.alias, item.hold_price, item.hold_num);
			throw new Error(
				'설정 형식 오류, https://github.com/1229juwon/stock-status 문서를 참고해주세요.',
			);
		});
	}

	private async ticker(): Promise<void> {
		try {
			logger.debug('call fetchData');
			const stockData = await stockProvider.fetch(
				this.stocks.map((s) => s.code),
			);

			stockData.forEach((data) => {
				const stock = this.stocks.find(
					(s) => s.code.toLowerCase() === data.code,
				);
				stock?.update(data);
			});

			logger.debug('render');
			render(this.stocks);
		} catch (error) {
			logger.error('%O', error);
		}
	}

	private openQuickPick(items: StockQuickPickItem[], title = ''): void {
		this.quickPick.busy = false;
		this.quickPick.value = '';
		this.quickPick.items = items;
		this.quickPick.placeholder = title;
		this.quickPick.show();
	}

	private async searchStocks(query: string): Promise<void> {
		const stockItems = await stockProvider.fetch([query]);
		const selectionItems: StockQuickPickItem[] = stockItems.map((data) => {
			const stock = new Stock(data.code || '', '');
			stock.update(data);
			return {
				label: this.isValidStock(stock) ? stock.name || '' : '결과 없음',
				action: () => this.handleStockSelection(stock),
			};
		});

		selectionItems.push({
			label: '돌아가기',
			action: () => this.openSearch(),
		});

		this.openQuickPick(selectionItems);
	}

	private async handleStockSelection(stock: Stock): Promise<void> {
		if (!this.isValidStock(stock)) {
			vscode.window.showErrorMessage(
				'해당 주식 코드가 존재하지 않습니다. 다시 추가해 주세요!',
			);
			return;
		}

		const code = stock.code.toLowerCase();
		if (this.stockExists(code)) {
			vscode.window.showInformationMessage(
				`주식 ${stock.name} (${code})는 이미 존재합니다!`,
			);
			return;
		}

		const currentStocks = Configuration.getStocks() || [];
		currentStocks.push({
			code,
			alias: stock.name,
			hold_price: 0,
			hold_num: 0,
		});
		await Configuration.updateSetting(
			'stocks',
			currentStocks,
			vscode.ConfigurationTarget.Global,
		);
		vscode.window.showInformationMessage(
			`성공적으로 추가됨: ${stock.name} (${code})`,
		);
		this.quickPick.hide();
		this.restart();
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
		const interval = Configuration.getUpdateInterval();
		if (this.timer) clearInterval(this.timer);
		this.stocks = this.loadChoiceStocks();
		this.timer = setInterval(() => this.ticker(), interval);
		this.ticker();
	}

	public stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		stopAllRender();
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
				if (this.timer) this.restart();
			}),
		);

		this.restart();
	}

	public dispose(): void {
		this.stop(); // 타이머 정리
		this.quickPick.dispose(); // QuickPick 해제
	}
}
