import Stock from '../models/stock';

export const keepDecimal = (num: number, fixed: number): string => {
	const result = parseFloat(String(num));
	return isNaN(result) ? '--' : result.toFixed(fixed);
};

/**
 * 숫자의 소수점 이하 자릿수 계산
 */
const getDecimalPlaces = (num: number): number => {
	const str = String(num);
	const dotIndex = str.indexOf('.');
	return dotIndex === -1 ? 0 : str.length - dotIndex - 1;
};

/**
 * 주식 정보의 가격 필드들에서 최대 소수점 자릿수 계산
 */
export const calcFixedNumber = (item: Stock): number => {
	const priceFields = [
		item.high,
		item.low,
		item.open,
		item.yestclose,
		item.updown,
	];
	const maxDecimals = Math.max(...priceFields.map(getDecimalPlaces));
	return maxDecimals === 0 ? 2 : maxDecimals;
};
