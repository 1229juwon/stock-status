import Configuration from '../configuration';

export class StockTimer {
	private timer: ReturnType<typeof setInterval> | null = null;
	private callback: (() => Promise<void>) | null = null;

	setCallback(callback: () => Promise<void>): void {
		this.callback = callback;
	}

	start(): void {
		const interval = Configuration.getUpdateInterval();
		if (this.timer) this.stop();
		this.timer = setInterval(async () => {
			if (this.callback) {
				await this.callback();
			}
		}, interval);
		if (this.callback) {
			this.callback(); // Initial call
		}
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	isRunning(): boolean {
		return this.timer !== null;
	}
}
