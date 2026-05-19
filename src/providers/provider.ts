import axios, { AxiosError, AxiosInstance } from 'axios';
import * as iconv from 'iconv-lite';
import logger from '../logger/logger';
import Stock from '../models/stock';

// Naver API 응답 필드명과 Stock 필드명 매핑
const FIELD_MAPPING = {
	cd: 'code', // 종목 코드
	nm: 'name', // 종목명

	sv: 'standardPrice', // 기준가 / 기준값
	nv: 'price', // 현재가

	cv: 'change', // 전일 대비 가격 변화
	cr: 'percent', // 등락률 (%)
	rf: 'riseFallFlag', // 상승/하락 구분 코드

	mt: 'marketType', // 시장 구분 코드
	ms: 'marketStatus', // 장 상태 (OPEN/CLOSE 등)
	tyn: 'tradingHaltYn', // 거래정지 여부

	pcv: 'yestclose', // 전일 종가

	ov: 'open', // 금일 시가
	hv: 'high', // 일중 최고가
	lv: 'low', // 일중 최저가

	ul: 'upperLimit', // 상한가
	ll: 'lowerLimit', // 하한가

	aq: 'volume', // 거래량
	aa: 'amount', // 거래대금

	nav: 'nav', // 순자산가치 (ETN/ETF NAV)

	keps: 'estimatedEps', // 추정 EPS
	eps: 'eps', // 주당순이익
	bps: 'bps', // 주당순자산

	cnsEps: 'consensusEps', // 컨센서스 EPS
	dv: 'dividend', // 배당금

	countOfListedStock: 'listedShares', // 상장 주식수

	nxtOverMarketPriceInfo: 'afterMarketInfo', // 시간외 시장 정보
} as const;

type StockQuery = string | { code: string };

const KOREAN_CODE_PATTERN = /^\d{6}$/;

const toCode = (item: StockQuery): string =>
	typeof item === 'string' ? item : item.code;

const isKoreanCode = (code: string): boolean =>
	KOREAN_CODE_PATTERN.test(code.trim());

const toNumber = (value: unknown): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Naver 주식 데이터 변환 (한국 주식용)
 */
class NaverStockTransform {
	private readonly mappedData: Record<string, any>;

	constructor(private readonly code: string, data: any) {
		this.mappedData = this.mapFields(data);
	}

	private mapFields(data: any): Record<string, any> {
		const result: Record<string, any> = {};
		for (const [apiField, stockField] of Object.entries(FIELD_MAPPING)) {
			const value = data[apiField];
			if (stockField === 'name' && value) {
				result[stockField] = String(value);
			} else {
				result[stockField] = value || (stockField === 'name' ? '---' : 0);
			}
		}
		return result;
	}

	transform(): Partial<Stock> {
		const change = Number(this.mappedData.change);
		return {
			code: this.code.toLowerCase(),
			name: this.mappedData.name,
			currency: 'KRW',
			standardPrice: Number(this.mappedData.standardPrice),
			price: Number(this.mappedData.price),
			change,
			updown: change,
			percent: Number(this.mappedData.percent),
			riseFallFlag: this.mappedData.riseFallFlag,
			marketType: this.mappedData.marketType,
			marketStatus: this.mappedData.marketStatus,
			tradingHaltYn: this.mappedData.tradingHaltYn,
			yestclose: Number(this.mappedData.yestclose),
			open: Number(this.mappedData.open),
			high: Number(this.mappedData.high),
			low: Number(this.mappedData.low),
			upperLimit: Number(this.mappedData.upperLimit),
			lowerLimit: Number(this.mappedData.lowerLimit),
			volume: Number(this.mappedData.volume),
			amount: Number(this.mappedData.amount),
			nav: Number(this.mappedData.nav),
			estimatedEps: Number(this.mappedData.estimatedEps),
			eps: Number(this.mappedData.eps),
			bps: Number(this.mappedData.bps),
			consensusEps: Number(this.mappedData.consensusEps),
			dividend: Number(this.mappedData.dividend),
			listedShares: Number(this.mappedData.listedShares),
			afterMarketInfo: this.mappedData.afterMarketInfo,
		};
	}
}

/**
 * Naver 주식 조회 인터페이스
 */
class NaverStockProvider {
	httpService: AxiosInstance;

	constructor() {
		// 주식 조회
		this.httpService = axios.create({
			timeout: 5000,
			baseURL: 'https://polling.finance.naver.com',
			responseType: 'arraybuffer',
			transformResponse: [
				(data) => {
					// EUC-KR 인코딩으로 디코딩
					const text = iconv.decode(Buffer.from(data), 'euckr');
					return JSON.parse(text);
				},
			],
		});
	}

	/**
	 * 코드 배열에서 순수 코드만 추출
	 */
	private extractCodes(codes: (string | { code: string })[]): string[] {
		return codes.map((c) => (typeof c === 'string' ? c : c.code));
	}

	/**
	 * 코드 매핑 생성 (대문자 -> 원본)
	 */
	private createCodeMap(codeList: string[]): Map<string, string> {
		const map = new Map<string, string>();
		codeList.forEach((code) => {
			map.set(code.toUpperCase(), code);
		});
		return map;
	}

	/**
	 * 응답 데이터 추출
	 */
	private extractResponseData(response: any): any[] {
		return response?.data?.result?.areas?.[0]?.datas ?? [];
	}

	/**
	 * 데이터(시세) 가져오기
	 */
	async fetch(codes: (string | { code: string })[]) {
		try {
			const codeList = this.extractCodes(codes);
			const codeMap = this.createCodeMap(codeList);
			const query = `SERVICE_ITEM:${codeList
				.map((c) => c.toUpperCase())
				.join(',')}`;

			logger.debug('NaverStockProvider.fetch - Query:', query);

			const response = await this.httpService.get('/api/realtime', {
				params: { query },
				headers: {
					referer: 'https://finance.naver.com',
					'user-agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				},
			});

			const datas = this.extractResponseData(response);
			logger.debug('NaverStockProvider.fetch - 데이터 갯수:', datas.length);
			logger.debug(
				'NaverStockProvider.fetch - 받은 데이터:',
				JSON.stringify(datas[0]),
			);

			const result = datas
				.filter((data) => data?.cd)
				.map((data) => {
					const originalCode = codeMap.get(data.cd.toUpperCase());
					return originalCode
						? new NaverStockTransform(originalCode, data).transform()
						: null;
				})
				.filter((item): item is Partial<Stock> => item !== null);

			logger.debug('변환된 데이터', result);
			return result;
		} catch (err: unknown) {
			const error = err as AxiosError;
			logger.error('NaverStockProvider.fetch - Error:', error.message);
			if (error.response) {
				throw new Error(`API Error: ${error.response.status}`);
			}
			if (error.request) {
				throw new Error('No response received from server');
			}
			throw error;
		}
	}
}

interface YahooQuote {
	symbol: string;
	shortName?: string;
	longName?: string;
	regularMarketPrice?: number;
	regularMarketChange?: number;
	regularMarketChangePercent?: number;
	regularMarketPreviousClose?: number;
	regularMarketOpen?: number;
	regularMarketDayHigh?: number;
	regularMarketDayLow?: number;
	regularMarketVolume?: number;
	currency?: string;
	marketState?: string;
	fullExchangeName?: string;
	exchange?: string;
}

interface YahooQuoteResponse {
	quoteResponse?: {
		result?: YahooQuote[];
		error?: unknown;
	};
}

interface YahooChartMeta {
	symbol?: string;
	currency?: string;
	marketState?: string;
	exchangeName?: string;
	regularMarketPrice?: number;
	previousClose?: number;
	chartPreviousClose?: number;
}

interface YahooChartIndicators {
	open?: number[];
	high?: number[];
	low?: number[];
	close?: number[];
	volume?: number[];
}

interface YahooChartResult {
	meta?: YahooChartMeta;
	indicators?: {
		quote?: YahooChartIndicators[];
	};
}

interface YahooChartResponse {
	chart?: {
		result?: YahooChartResult[];
		error?: unknown;
	};
}

interface StooqSymbolQuote {
	symbol?: string;
	name?: string;
	open?: string;
	high?: string;
	low?: string;
	close?: string;
	volume?: string;
}

interface StooqQuoteResponse {
	symbols?: StooqSymbolQuote[];
}

class YahooStockProvider {
	httpService: AxiosInstance;
	private readonly requestHeaders = {
		accept: 'application/json',
		'user-agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
		referer: 'https://finance.yahoo.com',
	};

	constructor() {
		this.httpService = axios.create({
			timeout: 5000,
			baseURL: 'https://query2.finance.yahoo.com',
		});
	}

	private getLastValue(values?: number[]): number | undefined {
		if (!values || values.length === 0) return undefined;
		for (let i = values.length - 1; i >= 0; i -= 1) {
			const value = values[i];
			if (value !== undefined && value !== null) return value;
		}
		return undefined;
	}

	private buildQuoteFromChart(
		symbol: string,
		chart: YahooChartResult,
	): YahooQuote | null {
		const meta = chart.meta;
		if (!meta) return null;
		const quote = chart.indicators?.quote?.[0];
		const open = this.getLastValue(quote?.open);
		const high = this.getLastValue(quote?.high);
		const low = this.getLastValue(quote?.low);
		const close = this.getLastValue(quote?.close);
		const volume = this.getLastValue(quote?.volume);
		const price = toNumber(meta.regularMarketPrice ?? close);
		const previousClose = toNumber(
			meta.previousClose ?? meta.chartPreviousClose,
		);
		const change = previousClose ? price - previousClose : 0;
		const changePercent = previousClose ? (change / previousClose) * 100 : 0;

		return {
			symbol: meta.symbol || symbol,
			shortName: meta.symbol || symbol,
			regularMarketPrice: price,
			regularMarketChange: change,
			regularMarketChangePercent: changePercent,
			regularMarketPreviousClose: previousClose,
			regularMarketOpen: toNumber(open),
			regularMarketDayHigh: toNumber(high),
			regularMarketDayLow: toNumber(low),
			regularMarketVolume: toNumber(volume),
			currency: meta.currency,
			marketState: meta.marketState,
			fullExchangeName: meta.exchangeName,
			exchange: meta.exchangeName,
		};
	}

	private async requestChartQuote(symbol: string): Promise<YahooQuote | null> {
		try {
			const response = await axios.get(
				`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
					symbol,
				)}`,
				{
					params: { range: '1d', interval: '1d' },
					headers: this.requestHeaders,
					timeout: 5000,
				},
			);
			const data = response.data as YahooChartResponse;
			const chart = data?.chart?.result?.[0];
			return chart ? this.buildQuoteFromChart(symbol, chart) : null;
		} catch (err: unknown) {
			return null;
		}
	}

	private async requestChartQuotes(symbols: string[]): Promise<YahooQuote[]> {
		const results = await Promise.all(
			symbols.map((symbol) => this.requestChartQuote(symbol)),
		);
		return results.filter((item): item is YahooQuote => item !== null);
	}

	private async mergeChartFallback(
		symbols: string[],
		results: YahooQuote[],
	): Promise<YahooQuote[]> {
		const missing = symbols.filter(
			(symbol) =>
				!results.some(
					(quote) => quote.symbol?.toUpperCase() === symbol.toUpperCase(),
				),
		);
		if (missing.length === 0) return results;
		const chartResults = await this.requestChartQuotes(missing);
		return [...results, ...chartResults];
	}

	private async requestQuotes(symbols: string[]): Promise<YahooQuote[]> {
		const params = { symbols: symbols.join(',') };
		try {
			const response = await this.httpService.get('/v7/finance/quote', {
				params,
				headers: this.requestHeaders,
			});
			const data = response.data as YahooQuoteResponse;
			const results = data?.quoteResponse?.result ?? [];
			return this.mergeChartFallback(symbols, results);
		} catch (err: unknown) {
			const error = err as AxiosError;
			const status = error.response?.status;
			if (status === 401 || status === 403 || status === 404) {
				try {
					const response = await axios.get(
						'https://query1.finance.yahoo.com/v7/finance/quote',
						{
							params,
							headers: this.requestHeaders,
							timeout: 5000,
						},
					);
					const data = response.data as YahooQuoteResponse;
					const results = data?.quoteResponse?.result ?? [];
					return this.mergeChartFallback(symbols, results);
				} catch (fallbackErr: unknown) {
					return this.requestChartQuotes(symbols);
				}
			}
			return this.requestChartQuotes(symbols);
		}
	}

	private normalizeSymbol(code: string): {
		symbol: string;
		originalCode: string;
	} {
		const trimmed = code.trim();
		const colonIndex = trimmed.indexOf(':');
		if (colonIndex > 0 && colonIndex < trimmed.length - 1) {
			return {
				symbol: trimmed.slice(colonIndex + 1),
				originalCode: trimmed,
			};
		}
		return { symbol: trimmed, originalCode: trimmed };
	}

	private toRiseFallFlag(change: number): string {
		if (change > 0) return '1';
		if (change < 0) return '4';
		return '3';
	}

	private transform(originalCode: string, quote: YahooQuote): Partial<Stock> {
		const change = toNumber(quote.regularMarketChange);
		return {
			code: originalCode.toLowerCase(),
			name: quote.longName || quote.shortName || quote.symbol || originalCode,
			currency: quote.currency || '',
			price: toNumber(quote.regularMarketPrice),
			change,
			updown: change,
			percent: toNumber(quote.regularMarketChangePercent),
			riseFallFlag: this.toRiseFallFlag(change),
			marketType: quote.fullExchangeName || quote.exchange || '',
			marketStatus: quote.marketState || '',
			yestclose: toNumber(quote.regularMarketPreviousClose),
			open: toNumber(quote.regularMarketOpen),
			high: toNumber(quote.regularMarketDayHigh),
			low: toNumber(quote.regularMarketDayLow),
			volume: toNumber(quote.regularMarketVolume),
		};
	}

	async fetch(codes: StockQuery[]) {
		try {
			const codeList = codes.map(toCode).filter((code) => code.trim());
			const symbolMap = new Map<string, string>();
			const symbols = codeList
				.map((code) => this.normalizeSymbol(code))
				.filter((item) => item.symbol)
				.map((item) => {
					const symbol = item.symbol.toUpperCase();
					if (!symbolMap.has(symbol)) {
						symbolMap.set(symbol, item.originalCode.toLowerCase());
					}
					return symbol;
				});

			const uniqueSymbols = Array.from(new Set(symbols));
			if (uniqueSymbols.length === 0) return [];

			const results = await this.requestQuotes(uniqueSymbols);
			return results
				.filter((quote) => quote?.symbol)
				.map((quote) => {
					const symbol = quote.symbol.toUpperCase();
					const originalCode =
						symbolMap.get(symbol) || quote.symbol.toLowerCase();
					return this.transform(originalCode, quote);
				});
		} catch (err: unknown) {
			const error = err as AxiosError;
			const status = error.response?.status;
			if (status === 401 || status === 403 || status === 404) {
				logger.warn(
					'YahooStockProvider.fetch - Blocked (%s), fallback will be used',
					status,
				);
				return [];
			}
			logger.error('YahooStockProvider.fetch - Error:', error.message);
			return [];
		}
	}
}

class StooqStockProvider {
	httpService: AxiosInstance;

	constructor() {
		this.httpService = axios.create({
			timeout: 5000,
			baseURL: 'https://stooq.com',
		});
	}

	private normalizeSymbol(code: string): {
		symbol: string;
		originalCode: string;
	} {
		const trimmed = code.trim();
		const colonIndex = trimmed.indexOf(':');
		if (colonIndex > 0 && colonIndex < trimmed.length - 1) {
			return {
				symbol: trimmed.slice(colonIndex + 1),
				originalCode: trimmed,
			};
		}
		return { symbol: trimmed, originalCode: trimmed };
	}

	private toStooqSymbol(symbol: string): string {
		const upper = symbol.toUpperCase();
		if (!upper) return symbol;
		if (upper.includes('.')) return upper;
		return `${upper}.US`;
	}

	private toCurrency(symbol: string): string {
		const upper = symbol.toUpperCase();
		if (upper.endsWith('.US')) return 'USD';
		if (upper.endsWith('.JP') || upper.endsWith('.T')) return 'JPY';
		if (upper.endsWith('.HK')) return 'HKD';
		if (upper.endsWith('.L') || upper.endsWith('.LN')) return 'GBP';
		if (upper.endsWith('.DE') || upper.endsWith('.FR') || upper.endsWith('.PA'))
			return 'EUR';
		return '';
	}

	private toRiseFallFlag(change: number): string {
		if (change > 0) return '1';
		if (change < 0) return '4';
		return '3';
	}

	private transform(
		originalCode: string,
		item: StooqSymbolQuote,
	): Partial<Stock> | null {
		const closeRaw = item.close;
		if (!closeRaw || closeRaw === '-') return null;
		const price = toNumber(closeRaw);
		const open = toNumber(item.open);
		const change = open ? price - open : 0;
		const percent = open ? (change / open) * 100 : 0;
		return {
			code: originalCode.toLowerCase(),
			name: item.name || item.symbol || originalCode,
			currency: this.toCurrency(item.symbol || originalCode),
			price,
			change,
			updown: change,
			percent,
			riseFallFlag: this.toRiseFallFlag(change),
			marketType: 'STOOQ',
			open,
			high: toNumber(item.high),
			low: toNumber(item.low),
			yestclose: open,
			volume: toNumber(item.volume),
		};
	}

	async fetch(codes: StockQuery[]) {
		try {
			const codeList = codes.map(toCode).filter((code) => code.trim());
			if (codeList.length === 0) return [];

			const symbolMap = new Map<string, string>();
			const symbols = codeList
				.map((code) => this.normalizeSymbol(code))
				.filter((item) => item.symbol)
				.map((item) => {
					const symbol = this.toStooqSymbol(item.symbol);
					symbolMap.set(symbol.toUpperCase(), item.originalCode.toLowerCase());
					return symbol;
				});

			const uniqueSymbols = Array.from(new Set(symbols));
			if (uniqueSymbols.length === 0) return [];

			const response = await this.httpService.get('/q/l/', {
				params: {
					s: uniqueSymbols.join(','),
					f: 'sd2t2ohlcvn',
					h: '1',
					e: 'json',
				},
			});

			const data = response.data as StooqQuoteResponse;
			const items = data?.symbols ?? [];
			return items
				.map((item) => {
					const symbolKey = (item.symbol || '').toUpperCase();
					const originalCode = symbolMap.get(symbolKey) || item.symbol || '';
					return originalCode ? this.transform(originalCode, item) : null;
				})
				.filter((item): item is Partial<Stock> => item !== null);
		} catch (err: unknown) {
			const error = err as AxiosError;
			logger.warn('StooqStockProvider.fetch - Error:', error.message);
			return [];
		}
	}
}

class CompositeStockProvider {
	constructor(
		private readonly naver: NaverStockProvider,
		private readonly yahoo: YahooStockProvider,
		private readonly stooq: StooqStockProvider,
	) {}

	async fetch(codes: StockQuery[]) {
		const codeList = codes.map(toCode);
		const koreanCodes = codeList.filter((code) => isKoreanCode(code));
		const foreignCodes = codeList.filter((code) => !isKoreanCode(code));

		const [koreanResult, yahooResult] = await Promise.all([
			koreanCodes.length ? this.naver.fetch(koreanCodes) : Promise.resolve([]),
			foreignCodes.length
				? this.yahoo.fetch(foreignCodes)
				: Promise.resolve([]),
		]);
		const resolvedCodes = new Set(
			yahooResult
				.map((item) => item.code)
				.filter((code): code is string => !!code)
				.map((code) => code.toLowerCase()),
		);
		const missingCodes = foreignCodes.filter(
			(code) => !resolvedCodes.has(code.toLowerCase()),
		);
		const stooqResult = missingCodes.length
			? await this.stooq.fetch(missingCodes)
			: [];

		return [...koreanResult, ...yahooResult, ...stooqResult];
	}
}

export const naverStockProvider = new NaverStockProvider();
export const yahooStockProvider = new YahooStockProvider();
export const stooqStockProvider = new StooqStockProvider();
export const stockProvider = new CompositeStockProvider(
	naverStockProvider,
	yahooStockProvider,
	stooqStockProvider,
);
