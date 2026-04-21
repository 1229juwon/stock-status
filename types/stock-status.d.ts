export interface StockOption {
	code: string;
	alias: string;
	hold_price?: number;
	hold_num?: number;
}
type color = string;

export type StockOptions = (string | StockOption)[];
export type UpdateIntervalOption = number;
export type RiseColorOption = color;
export type FallColorOption = color;

/**
 * Naver API 응답 타입
 */
export interface NaverStockData {
	cd: string; // 종목 코드
	nm: string; // 종목명
	nv: number; // 현재가
	pcv: number; // 전일 종가
	cv: number; // 전일 대비
	cr: number; // 등락률 (%)
	rf: '1' | '2' | '3'; // 등락 구분 (1:상승,2:하락,3:보합)
	ov: number; // 시가
	hv: number; // 고가
	lv: number; // 저가
}

export interface NaverArea {
	name: string;
	datas: NaverStockData[];
}

export interface NaverStockResponse {
	resultCode: string;
	result: {
		pollingInterval: number;
		areas: NaverArea[];
		time: number;
	};
}
