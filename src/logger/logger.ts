import { format } from 'util';

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug';
type ConsoleMethod = 'error' | 'warn' | 'log';

class Logger {
	/**
	 * @private
	 */
	private prefix(loggerLevel: LogLevel): string {
		return format('[%s] [%s]', new Date().toLocaleString(), loggerLevel);
	}

	/**
	 * Logging Method
	 * @private
	 */
	private log(
		level: LogLevel,
		consoleMethod: ConsoleMethod,
		msg: string,
		...args: any[]
	) {
		const consoleFunc = console[consoleMethod];
		consoleFunc(format(`${this.prefix(level)} ${msg}`, ...args));
	}

	fatal(msg: string, ...args: any[]): void {
		this.log('fatal', 'error', msg, ...args);
	}

	error(msg: string, ...args: any[]): void {
		this.log('error', 'error', msg, ...args);
	}

	warn(msg: string, ...args: any[]): void {
		this.log('warn', 'warn', msg, ...args);
	}

	info(msg: string, ...args: any[]): void {
		this.log('info', 'log', msg, ...args);
	}

	debug(msg: string, ...args: any[]): void {
		this.log('debug', 'log', msg, ...args);
	}
}

export default new Logger();
