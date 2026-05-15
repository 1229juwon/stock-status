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

export const naverStockProvider = new NaverStockProvider();
export const stockProvider = naverStockProvider;
