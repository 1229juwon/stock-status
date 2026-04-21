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
}
