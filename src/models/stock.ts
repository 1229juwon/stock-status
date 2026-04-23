export default class Stock {
	code: string;
	name: string | null;
	alias: string;
	hold_price = 0;
	hold_num = 0;
	price = 0;
	updown = 0;
	percent = 0;
	high = 0;
	low = 0;
	open = 0;
	yestclose = 0;

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
		const numericFields: (keyof Pick<
			Stock,
			'price' | 'high' | 'low' | 'updown' | 'percent' | 'open' | 'yestclose'
		>)[] = ['price', 'high', 'low', 'updown', 'percent', 'open', 'yestclose'];

		if (origin.name !== undefined) this.name = origin.name;

		numericFields.forEach((field) => {
			if (origin[field] !== undefined) {
				(this[field] as number) = origin[field] as number;
			}
		});
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
