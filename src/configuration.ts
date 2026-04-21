import * as vscode from 'vscode';
import { StockOptions } from '../types/stock-status';

export default class Configuration {
	/**
	 * @private
	 * 내부용: stock-status 설정 객체 반환
	 */
	private static stockBarConfig() {
		return vscode.workspace.getConfiguration('stock-status');
	}

	/**
	 * 설정 값 조회 헬퍼 메서드
	 * @private
	 */
	private static getSetting<T>(key: string, defaultValue: T): T {
		const value = this.stockBarConfig().get(key);
		return value !== undefined ? (value as T) : defaultValue;
	}

	/**
	 * 주식 목록 반환
	 */
	static getStocks() {
		const stocks = Configuration.stockBarConfig().get('stocks');
		if (Object.prototype.toString.call(stocks) === '[object Object]') {
			return this.updateStocks(stocks as Record<string, string>);
		}
		return stocks as StockOptions;
	}

	/**
	 * 데이터 업데이트 간격(밀리초) 반환
	 */
	static getUpdateInterval(): number {
		return this.getSetting('updateInterval', 5000);
	}

	/**
	 * 상승 색상 반환
	 */
	static getRiseColor() {
		return Configuration.stockBarConfig().get('riseColor');
	}

	/**
	 * 하락 색상 반환
	 */
	static getFallColor() {
		return Configuration.stockBarConfig().get('fallColor');
	}

	/**
	 * 계좌 손익 표시 여부 반환
	 */
	static getShowAccountPnL(): boolean {
		return this.getSetting('showAccountPnL', true);
	}

	/**
	 * 주식 설정 형식을 업데이트하고 저장
	 * @param stocks 변환할 주식 설정 객체 (코드: 별명)
	 * @returns 변환된 주식 옵션 배열
	 */
	static updateStocks(stocks: Record<string, string>) {
		const newStocks: StockOptions = Object.entries(stocks).map(
			([code, alias]) => (alias ? { code, alias } : code),
		);
		Configuration.stockBarConfig().update('stocks', newStocks, 1);
		return newStocks;
	}

	/**
	 * 설정값 업데이트
	 */
	static async updateSetting(
		key: string,
		value: any,
		scope = vscode.ConfigurationTarget.Global,
	): Promise<void> {
		await this.stockBarConfig().update(key, value, scope);
	}
}
