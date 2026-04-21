import { format } from 'util';
import * as vscode from 'vscode';
import Configuration from './configuration';
import Stock from './models/stock';
import { keepDecimal } from './utils/utils';

const stockHub = new Map();
let accountPnLBar: vscode.StatusBarItem | null = null;

function hideAccountPnLBar() {
	if (!accountPnLBar) {
		return;
	}
	accountPnLBar.hide();
	accountPnLBar.dispose();
	accountPnLBar = null;
}

function getItemColor(item: Stock) {
	return item.percent >= 0
		? Configuration.getRiseColor()
		: Configuration.getFallColor();
}

function getItemText(item: Stock) {
	const hasHold = item.hold_num > 0;
	const showAccountPnL = Configuration.getShowAccountPnL();
	const formattedPrice = Math.round(item.price).toLocaleString();
	const base = format(
		'%s %s (%s%)',
		item.alias ?? item.name,
		formattedPrice,
		keepDecimal(item.percent, 2),
	);
	if (showAccountPnL && hasHold) {
		// 추가 예정
		return `${base}`;
	}
	return base;
}

function getTooltipText(item: Stock) {
	const hasHold = item.hold_num > 0;
	const tooltips = [
		`【${item.name || item.code}】오늘 시세(${keepDecimal(item.percent, 2)}%)`,
		`등락：${item.updown}`,
		`최고：${item.high}   최저：${item.low}`,
		`금일 오픈：${item.open}   어제 종가：${item.yestclose}`,
	];
	if (hasHold) {
		const dailyPnL = Math.round(item.updown * item.hold_num);
		const dailyPnLStr = dailyPnL > 0 ? `+${dailyPnL}` : `${dailyPnL}`;
		tooltips.push(`일일 손익：${dailyPnLStr}`);

		const effectivePrice = item.price || item.yestclose || item.hold_price;
		const totalPnL = Math.round(
			(effectivePrice - item.hold_price) * item.hold_num,
		);
		const totalPnLStr = totalPnL > 0 ? `+${totalPnL}` : `${totalPnL}`;
		tooltips.push(`보유 손익：${totalPnLStr}`);
	}
	return tooltips.join('\n');
}

/**
 * 주식 목록을 상태 바에 렌더링
 */
export const render = (stocks: Stock[]) => {
	// 설정 업데이트 후 삭제된 주식 제거
	const deleted = Array.from(stockHub.keys()).filter(
		(code) => !stocks.some((s: Stock) => s.code === code),
	);
	for (const item of deleted) {
		stockHub.get(item).barItem.hide();
		stockHub.get(item).barItem.dispose();
		stockHub.delete(item);
	}

	// 설정 업데이트 후 추가된 주식
	const added = stocks.filter((s: Stock) => !stockHub.has(s.code));
	for (const item of added) {
		const barItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
		);
		stockHub.set(item.code, { barItem });
		barItem.show();
	}

	// 주식 가격 업데이트
	for (const stock of stocks) {
		const barItem = stockHub.get(stock.code);
		if (barItem) {
			barItem.barItem.text = getItemText(stock);
			barItem.barItem.color = getItemColor(stock);
			barItem.barItem.tooltip = getTooltipText(stock);
		}
	}

	// 계정 일일 손익 요약 렌더링
	if (Configuration.getShowAccountPnL()) {
		renderAccountPnL(stocks);
	} else {
		hideAccountPnLBar();
	}
};

function renderAccountPnL(stocks: Stock[]) {
	// 모든 보유 주식의 일일 손익 요약
	let totalDailyPnL = 0;
	let hasAnyHold = false;
	const details: string[] = [];

	for (const stock of stocks) {
		if (stock.hold_num > 0) {
			hasAnyHold = true;
			const pnl = Math.round(stock.updown * stock.hold_num);
			totalDailyPnL += pnl;
			const pnlStr = pnl > 0 ? `+${pnl}` : `${pnl}`;
			details.push(`${stock.alias || stock.name || stock.code}: ${pnlStr}`);
		}
	}

	if (!hasAnyHold) {
		hideAccountPnLBar();
		return;
	}

	if (!accountPnLBar) {
		accountPnLBar = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
		);
		accountPnLBar.show();
	}

	const pnlStr = totalDailyPnL > 0 ? `+${totalDailyPnL}` : `${totalDailyPnL}`;
	accountPnLBar.text = `오늘：${pnlStr}`;
	accountPnLBar.color =
		totalDailyPnL >= 0
			? (Configuration.getRiseColor() as string)
			: (Configuration.getFallColor() as string);

	const tooltipLines = ['【계정 일일 손익】', ...details, `합계：${pnlStr}`];
	accountPnLBar.tooltip = tooltipLines.join('\n');
}

export function stopAllRender() {
	for (const [, item] of stockHub) {
		const barItem = item.barItem;
		barItem.hide();
		barItem.dispose();
	}
	stockHub.clear();

	hideAccountPnLBar();
}
