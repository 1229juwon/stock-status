import axios, { AxiosError, AxiosInstance } from 'axios';
import * as iconv from 'iconv-lite';
import logger from '../logger/logger';
import Stock from '../models/stock';

// Naver API 응답 필드명과 Stock 필드명 매핑
const FIELD_MAPPING = {
	nm: 'name',
	nv: 'price',
	pcv: 'yestclose',
	cr: 'percent',
	cv: 'updown',
	ov: 'open',
	hv: 'high',
	lv: 'low',
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
		return {
			code: this.code.toLowerCase(),
			name: this.mappedData.name,
			price: Number(this.mappedData.price),
			yestclose: Number(this.mappedData.yestclose),
			percent: Number(this.mappedData.percent),
			updown: Number(this.mappedData.updown),
			open: Number(this.mappedData.open),
			high: Number(this.mappedData.high),
			low: Number(this.mappedData.low),
		};
	}
}

/**
 * Naver 주식 조회 인터페이스
 */
class NaverStockProvider {
	httpService: AxiosInstance;

	constructor() {
		this.httpService = axios.create({
			timeout: 10000,
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
	 * 데이터 가져오기
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
			logger.debug('NaverStockProvider.fetch - Data count:', datas.length);
			logger.debug(
				'NaverStockProvider.fetch - Raw data sample:',
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
