import { format } from 'util';
import * as vscode from 'vscode';
import Configuration from '../configuration';
import Stock from '../models/stock';
import { keepDecimal } from '../utils/utils';

function formatNumber(num: number): string {
	return Math.round(num).toLocaleString();
}

function formatPercent(num: number): string {
	return keepDecimal(num, 2) + '%';
}

function getPercentPrefix(riseFallFlag: string): string {
	switch (riseFallFlag) {
		case '1':
		case '2':
			return '+';
		case '4':
		case '5':
			return '-';
		default:
			return '';
	}
}

function getTrendDirection(
	riseFallFlag: string,
): 'up' | 'down' | 'neutral' | 'unknown' {
	switch (riseFallFlag) {
		case '1':
		case '2':
			return 'up';
		case '3':
			return 'neutral';
		case '4':
		case '5':
			return 'down';
		default:
			return 'unknown';
	}
}

function getTrendIcon(stock: Stock): string {
	const direction = getTrendDirection(stock.riseFallFlag);
	if (direction === 'up') return '📈';
	if (direction === 'down') return '📉';
	if (direction === 'neutral') return '➡️';
	return stock.percent > 0 ? '📈' : stock.percent < 0 ? '📉' : '➡️';
}

function getPnLColor(pnl: number): string {
	return pnl > 0 ? '🟢' : pnl < 0 ? '🔴' : '⚪';
}

export class StockRenderer {
	private stockHub = new Map<string, vscode.StatusBarItem>();
	private accountPnLBar: vscode.StatusBarItem | null = null;

	/**
	 * 주식 목록을 상태 바에 렌더링
	 */
	render(stocks: Stock[]): void {
		this.cleanupRemovedStocks(stocks);
		this.addNewStocks(stocks);
		this.updateStockDisplays(stocks);

		if (Configuration.getShowAccountPnL()) {
			this.renderAccountPnL(stocks);
		} else {
			this.hideAccountPnLBar();
		}
	}

	/**
	 * 모든 렌더링 정리
	 */
	stopAllRender(): void {
		for (const [, barItem] of this.stockHub) {
			barItem.hide();
			barItem.dispose();
		}
		this.stockHub.clear();
		this.hideAccountPnLBar();
	}

	private cleanupRemovedStocks(stocks: Stock[]): void {
		const currentCodes = new Set(stocks.map((s) => s.code));
		const toRemove = Array.from(this.stockHub.keys()).filter(
			(code) => !currentCodes.has(code),
		);

		for (const code of toRemove) {
			const barItem = this.stockHub.get(code);
			if (barItem) {
				barItem.hide();
				barItem.dispose();
			}
			this.stockHub.delete(code);
		}
	}

	private addNewStocks(stocks: Stock[]): void {
		const existingCodes = new Set(this.stockHub.keys());
		const toAdd = stocks.filter((s) => !existingCodes.has(s.code));

		for (const stock of toAdd) {
			const barItem = vscode.window.createStatusBarItem(
				vscode.StatusBarAlignment.Left,
			);
			this.stockHub.set(stock.code, barItem);
			barItem.show();
		}
	}

	private updateStockDisplays(stocks: Stock[]): void {
		for (const stock of stocks) {
			const barItem = this.stockHub.get(stock.code);
			if (barItem) {
				barItem.text = this.getItemText(stock);
				barItem.color = this.getItemColor(stock);
				barItem.tooltip = this.getTooltipMarkdown(stock);
			}
		}
	}

	private getItemColor(stock: Stock): string | vscode.ThemeColor | undefined {
		const direction = getTrendDirection(stock.riseFallFlag);
		if (direction === 'up') return Configuration.getRiseColor();
		if (direction === 'down') return Configuration.getFallColor();
		return undefined;
	}

	private getItemText(stock: Stock): string {
		const hasHold = stock.hold_num > 0;
		const showAccountPnL = Configuration.getShowAccountPnL();
		const formattedPrice = Math.round(stock.price).toLocaleString();
		const percentPrefix = getPercentPrefix(stock.riseFallFlag);
		const base = format(
			'%s %s (%s%)',
			stock.getDisplayName(),
			formattedPrice,
			`${percentPrefix}${keepDecimal(stock.percent, 2)}`,
		);
		if (showAccountPnL && hasHold) {
			// TODO: Implement account P&L display
			return base;
		}
		return base;
	}

	private getTooltipMarkdown(stock: Stock): vscode.MarkdownString {
		const hasHold = stock.hold_num > 0;
		const trendIcon = getTrendIcon(stock);
		const direction = getTrendDirection(stock.riseFallFlag);
		const priceSign =
			direction === 'down' ? '-' : direction === 'up' ? '+' : '';
		const percentPrefix = getPercentPrefix(stock.riseFallFlag);

		let markdown = `**${trendIcon} ${stock.getDisplayName()}**\n\n`;
		markdown += `**${formatNumber(stock.price)}원** (${priceSign}${formatNumber(
			stock.updown,
		)}원 / ${percentPrefix}${formatPercent(stock.percent)})\n\n`;
		markdown += `일중 최고가: ${formatNumber(stock.high)}원\n\n`;
		markdown += `일중 최저가: ${formatNumber(stock.low)}원\n\n`;

		if (hasHold) {
			const dailyPnL = stock.getDailyPnL();
			const totalPnL = stock.getTotalPnL();
			const dailyColor = getPnLColor(dailyPnL);
			const totalColor = getPnLColor(totalPnL);

			markdown += `\n---\n\n`;
			markdown += `**보유:** ${stock.hold_num.toLocaleString()}주 (평단: ${formatNumber(
				stock.hold_price,
			)}원)\n\n`;
			markdown += `**일일손익:** ${dailyColor} ${
				dailyPnL > 0 ? '+' : ''
			}${formatNumber(dailyPnL)}원\n\n`;
			markdown += `**누적손익:** ${totalColor} ${
				totalPnL > 0 ? '+' : ''
			}${formatNumber(totalPnL)}원\n`;
		}

		const md = new vscode.MarkdownString(markdown);
		md.isTrusted = true;
		return md;
	}

	private renderAccountPnL(stocks: Stock[]): void {
		let totalDailyPnL = 0;
		let hasAnyHold = false;
		const details: Array<{ name: string; pnl: number }> = [];

		for (const stock of stocks) {
			if (stock.hold_num > 0) {
				hasAnyHold = true;
				const pnl = stock.getDailyPnL();
				totalDailyPnL += pnl;
				details.push({ name: stock.getDisplayName(), pnl });
			}
		}

		if (!hasAnyHold) {
			this.hideAccountPnLBar();
			return;
		}

		if (!this.accountPnLBar) {
			this.accountPnLBar = vscode.window.createStatusBarItem(
				vscode.StatusBarAlignment.Left,
			);
			this.accountPnLBar.show();
		}

		const pnlStr =
			totalDailyPnL > 0
				? `+${formatNumber(totalDailyPnL)}`
				: formatNumber(totalDailyPnL);
		this.accountPnLBar.text = `오늘：${pnlStr}원`;
		this.accountPnLBar.color =
			totalDailyPnL >= 0
				? (Configuration.getRiseColor() as string)
				: (Configuration.getFallColor() as string);

		let markdown = `**💼 계정 일일 손익**\n\n`;
		markdown += `| 종목 | 일일손익 |\n`;
		markdown += `|------|----------|\n`;
		for (const detail of details) {
			const pnlStr =
				detail.pnl > 0
					? `+${formatNumber(detail.pnl)}`
					: formatNumber(detail.pnl);
			const color = getPnLColor(detail.pnl);
			markdown += `| ${detail.name} | ${color} ${pnlStr}원 |\n`;
		}
		markdown += `\n**합계: ${getPnLColor(totalDailyPnL)} ${
			totalDailyPnL > 0 ? '+' : ''
		}${formatNumber(totalDailyPnL)}원**`;

		const md = new vscode.MarkdownString(markdown);
		md.isTrusted = true;
		this.accountPnLBar.tooltip = md;
	}

	private hideAccountPnLBar(): void {
		if (this.accountPnLBar) {
			this.accountPnLBar.hide();
			this.accountPnLBar.dispose();
			this.accountPnLBar = null;
		}
	}
}

const stockRenderer = new StockRenderer();

export const render = (stocks: Stock[]) => stockRenderer.render(stocks);
export const stopAllRender = () => stockRenderer.stopAllRender();
