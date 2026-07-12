import type { BotList } from "./bot-list.js";
import type { BotStats, StatsProvider } from "./types.js";

/** Default global posting interval: 10 minutes. */
export const DEFAULT_INTERVAL = 10 * 60 * 1000;

export interface StatsPosterOptions {
	/** The bot list adapters to post stats to. */
	lists: BotList[];
	/** Called on every cycle to get the bot's current stats. */
	getStats: StatsProvider;
	/**
	 * The bot's Discord application (client) ID.
	 * Required by some lists (e.g. Discords.com) that embed it in the URL.
	 */
	botId?: string;
	/**
	 * Global posting interval in milliseconds. Defaults to 10 minutes.
	 * Each list can override this with its own `interval` option.
	 */
	interval?: number;
	/** Post immediately when `start()` is called. Defaults to true. */
	postOnStart?: boolean;
	/** Called after a successful post to a list. */
	onPost?: (list: BotList, stats: BotStats) => void;
	/** Called when posting to a list fails. Errors never crash your bot. */
	onError?: (list: BotList, error: unknown) => void;
}

/**
 * Periodically collects your bot's stats and posts them to every
 * configured bot list. Runs one independent timer per list so each
 * can have its own interval.
 *
 * Works on Node.js (>=18), Bun and Deno - it only uses the
 * web-standard `fetch` and timers.
 */
export class StatsPoster {
	readonly lists: readonly BotList[];

	private readonly getStats: StatsProvider;
	private readonly botId?: string;
	private readonly interval: number;
	private readonly postOnStart: boolean;
	private readonly onPost?: (list: BotList, stats: BotStats) => void;
	private readonly onError?: (list: BotList, error: unknown) => void;

	private timers = new Map<string, ReturnType<typeof setInterval>>();

	constructor(options: StatsPosterOptions) {
		if (!options || typeof options.getStats !== "function") {
			throw new TypeError('StatsPoster requires a "getStats" function.');
		}
		if (!Array.isArray(options.lists) || options.lists.length === 0) {
			throw new TypeError('StatsPoster requires a non-empty "lists" array.');
		}
		if (options.interval !== undefined && (!Number.isFinite(options.interval) || options.interval <= 0)) {
			throw new TypeError('"interval" must be a positive number of milliseconds.');
		}

		const seen = new Set<string>();
		for (const list of options.lists) {
			if (seen.has(list.key)) {
				throw new TypeError(`Duplicate bot list "${list.key}" - each list may only be added once.`);
			}
			seen.add(list.key);
			if (list.requiresBotId && !options.botId) {
				throw new TypeError(`${list.name} requires "botId" to be set in the StatsPoster options.`);
			}
		}

		this.lists = [...options.lists];
		this.getStats = options.getStats;
		this.botId = options.botId;
		this.interval = options.interval ?? DEFAULT_INTERVAL;
		this.postOnStart = options.postOnStart ?? true;
		this.onPost = options.onPost;
		this.onError = options.onError;
	}

	/** Whether the poster is currently running. */
	get running(): boolean {
		return this.timers.size > 0;
	}

	/**
	 * Starts periodic posting. Each list gets its own timer using its
	 * `interval` option, or the global interval as a fallback.
	 * Calling start() while already running is a no-op.
	 */
	start(): void {
		if (this.running) return;

		for (const list of this.lists) {
			const ms = list.interval ?? this.interval;
			const timer = setInterval(() => {
				void this.postToList(list);
			}, ms);
			// Don't keep the process alive just for stats posting (Node/Bun).
			(timer as { unref?: () => void }).unref?.();
			this.timers.set(list.key, timer);
		}

		if (this.postOnStart) void this.postNow();
	}

	/** Stops all timers. Safe to call multiple times; start() can be called again later. */
	stop(): void {
		for (const timer of this.timers.values()) clearInterval(timer);
		this.timers.clear();
	}

	/**
	 * Posts the current stats immediately.
	 *
	 * @param key Optional list key (e.g. "topgg") to post to a single list.
	 * @returns A per-list result map; errors are captured, never thrown,
	 *          unless `getStats` itself throws.
	 */
	async postNow(key?: string): Promise<Map<string, { ok: boolean; error?: unknown }>> {
		const targets = key ? this.lists.filter((l) => l.key === key) : this.lists;
		if (key && targets.length === 0) {
			throw new TypeError(`No bot list with key "${key}" is configured.`);
		}

		const stats = await this.collectStats();
		const results = new Map<string, { ok: boolean; error?: unknown }>();

		await Promise.all(
			targets.map(async (list) => {
				try {
					await list.post(stats, { botId: this.botId });
					results.set(list.key, { ok: true });
					this.onPost?.(list, stats);
				} catch (error) {
					results.set(list.key, { ok: false, error });
					this.onError?.(list, error);
				}
			}),
		);

		return results;
	}

	/** Posts to a single list on its timer tick, swallowing errors into onError. */
	private async postToList(list: BotList): Promise<void> {
		let stats: BotStats;
		try {
			stats = await this.collectStats();
		} catch (error) {
			this.onError?.(list, error);
			return;
		}
		try {
			await list.post(stats, { botId: this.botId });
			this.onPost?.(list, stats);
		} catch (error) {
			this.onError?.(list, error);
		}
	}

	private async collectStats(): Promise<BotStats> {
		const stats = await this.getStats();
		if (!stats || typeof stats.guildCount !== "number" || !Number.isFinite(stats.guildCount) || stats.guildCount < 0) {
			throw new TypeError('getStats() must return an object with a non-negative numeric "guildCount".');
		}
		return stats;
	}
}
