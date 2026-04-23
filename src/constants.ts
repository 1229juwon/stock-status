export const MESSAGES = {
	STOCK_NOT_FOUND: '해당 주식 코드가 존재하지 않습니다. 다시 추가해 주세요!',
	STOCK_ALREADY_EXISTS: (name: string, code: string) =>
		`주식 ${name} (${code})는 이미 존재합니다!`,
	STOCK_ADDED_SUCCESS: (name: string, code: string) =>
		`성공적으로 추가됨: ${name} (${code})`,
	CONFIG_ERROR:
		'설정 형식 오류, https://github.com/1229juwon/stock-status 문서를 참고해주세요.',
} as const;

export const DEFAULTS = {
	UPDATE_INTERVAL: 5000,
	SHOW_ACCOUNT_PNL: true,
} as const;
