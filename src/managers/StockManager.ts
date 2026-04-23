import * as vscode from 'vscode';
import Configuration from '../configuration';
import { MESSAGES } from '../constants';
import logger from '../logger/logger';
import Stock from '../models/stock';
import { stockProvider } from '../providers/provider';

export class StockManager {
	private stocks: Stock[] = [];

	constructor() {
		this.loadStocks();
	}

	loadStocks(): void {
		this.stocks = Configuration.getStocks().map((item) => {
			if (typeof item === 'string') return new Stock(item);
			if (typeof item === 'object')
				return new Stock(item.code, item.alias, item.hold_price, item.hold_num);
			throw new Error(MESSAGES.CONFIG_ERROR);
		});
	}

	getStocks(): Stock[] {
		return this.stocks;
	}

	async fetchStockData(): Promise<void> {
		try {
			logger.debug('Fetching stock data');
			const stockData = await stockProvider.fetch(
				this.stocks.map((s) => s.code),
			);

			stockData.forEach((data) => {
				const stock = this.stocks.find(
					(s) => s.code.toLowerCase() === data.code,
				);
				stock?.update(data);
			});

			logger.debug('Stock data updated');
		} catch (error) {
			logger.error('%O', error);
		}
	}

	isStockExists(code: string): boolean {
		const normalizedCode = code.toLowerCase();
		const currentStocks = Configuration.getStocks() || [];
		return currentStocks.some((item) =>
			typeof item === 'string'
				? item.toLowerCase() === normalizedCode
				: item.code.toLowerCase() === normalizedCode,
		);
	}

	async addStock(code: string, name: string): Promise<boolean> {
		const normalizedCode = code.toLowerCase();
		if (this.isStockExists(normalizedCode)) {
			vscode.window.showInformationMessage(
				MESSAGES.STOCK_ALREADY_EXISTS(name, normalizedCode),
			);
			return false;
		}

		const currentStocks = Configuration.getStocks() || [];
		currentStocks.push({
			code: normalizedCode,
			alias: name,
			hold_price: 0,
			hold_num: 0,
		});
		await Configuration.updateSetting(
			'stocks',
			currentStocks,
			vscode.ConfigurationTarget.Global,
		);
		vscode.window.showInformationMessage(
			MESSAGES.STOCK_ADDED_SUCCESS(name, normalizedCode),
		);
		this.loadStocks();
		return true;
	}

	async searchStock(query: string): Promise<Stock | null> {
		const stockItems = await stockProvider.fetch([query]);
		if (stockItems.length === 0) return null;

		const data = stockItems[0];
		const stock = new Stock(data.code || '', '');
		stock.update(data);
		return stock.isValid() ? stock : null;
	}
}
