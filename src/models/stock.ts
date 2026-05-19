export default class Stock {
	code: string;
	name: string | null;
	alias: string;
	standardPrice = 0;
	price = 0;
	change = 0;
	hold_price = 0;
	hold_num = 0;
	updown = 0;
	percent = 0;
	riseFallFlag = '';
	currency = '';
	marketType = '';
	marketStatus = '';
	tradingHaltYn = '';
	high = 0;
	low = 0;
	open = 0;
	yestclose = 0;
	upperLimit = 0;
	lowerLimit = 0;
	volume = 0;
	amount = 0;
	nav = 0;
	estimatedEps = 0;
	eps = 0;
	bps = 0;
	consensusEps = 0;
	dividend = 0;
	listedShares = 0;
	afterMarketInfo = '';

	constructor(
		code: string,
		alias?: string | undefined,
		hold_price?: number | undefined,
		hold_num?: number | undefined,
	) {
		this.code = code;
		this.name = null;
		this.alias = alias ?? '';
		this.hold_price = hold_price ?? 0;
		this.hold_num = hold_num ?? 0;
	}

	update(origin: Partial<Stock>): void {
		const numericFields: (keyof Stock)[] = [
			'standardPrice',
			'price',
			'change',
			'updown',
			'percent',
			'high',
			'low',
			'open',
			'yestclose',
			'upperLimit',
			'lowerLimit',
			'volume',
			'amount',
			'nav',
			'estimatedEps',
			'eps',
			'bps',
			'consensusEps',
			'dividend',
			'listedShares',
		];

		if (origin.name !== undefined) {
			this.name = origin.name;
		}
		if (origin.riseFallFlag !== undefined) {
			this.riseFallFlag = origin.riseFallFlag;
		}
		if (origin.currency !== undefined) {
			this.currency = origin.currency;
		}
		if (origin.marketType !== undefined) {
			this.marketType = origin.marketType;
		}
		if (origin.marketStatus !== undefined) {
			this.marketStatus = origin.marketStatus;
		}
		if (origin.tradingHaltYn !== undefined) {
			this.tradingHaltYn = origin.tradingHaltYn;
		}
		if (origin.afterMarketInfo !== undefined) {
			this.afterMarketInfo = origin.afterMarketInfo;
		}

		numericFields.forEach((field) => {
			if (origin[field] !== undefined) {
				(this[field] as number) = origin[field] as number;
			}
		});

		if (origin.change !== undefined && origin.updown === undefined) {
			this.updown = origin.change;
		}
	}

	/**
	 * 주식이 유효한지 확인
	 */
	isValid(): boolean {
		return !!(this.name && this.name !== '---');
	}

	/**
	 * 일일 손익 계산
	 */
	getDailyPnL(): number {
		if (this.hold_num <= 0) return 0;
		return Math.round(this.updown * this.hold_num);
	}

	/**
	 * 보유 손익 계산
	 */
	getTotalPnL(): number {
		if (this.hold_num <= 0) return 0;
		const effectivePrice = this.price || this.yestclose || this.hold_price;
		return Math.round((effectivePrice - this.hold_price) * this.hold_num);
	}

	/**
	 * 표시 이름 반환
	 */
	getDisplayName(): string {
		return this.alias || this.name || this.code;
	}
}
