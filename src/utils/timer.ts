import Configuration from '../configuration';

class Timer {
	/**
	 * 설정된 업데이트 간격만큼 대기
	 */
	async await(): Promise<void> {
		return this.sleep(Configuration.getUpdateInterval());
	}

	/**
	 * 지정된 ms만큼 대기
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * 평일 개장시간 (9:00-15:30)
	 */
	isWorkTime(): boolean {
		const hours = new Date().getHours();
		const minutes = new Date().getMinutes();
		const time = hours * 100 + minutes;
		return time >= 900 && time <= 153;
	}

	/**
	 * 평일 여부 확인 (월~금)
	 */
	isWorkDay(): boolean {
		const currentDay = new Date().getDay();
		return ![0, 6].includes(currentDay);
	}
}

export default new Timer();
