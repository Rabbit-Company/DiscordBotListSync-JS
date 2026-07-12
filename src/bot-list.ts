import type { BotStats, HttpRequestSpec, PostContext } from "./types.js";

/** Options common to every bot list adapter. */
export interface BotListOptions {
	/** The API token for this specific bot list. */
	token: string;
	/**
	 * Per-list posting interval in milliseconds.
	 * Overrides the poster's global interval for this list only.
	 */
	interval?: number;
}

/** Thrown when a bot list API responds with a non-2xx status. */
export class BotListError extends Error {
	/** Machine-friendly key of the list, e.g. "topgg". */
	readonly list: string;
	/** HTTP status code returned by the API. */
	readonly status: number;
	/** Raw response body text, useful for debugging. */
	readonly responseBody: string;

	constructor(list: string, status: number, responseBody: string) {
		super(`[${list}] request failed with status ${status}: ${responseBody || "<empty body>"}`);
		this.name = "BotListError";
		this.list = list;
		this.status = status;
		this.responseBody = responseBody;
	}
}

/**
 * Base class for all bot list adapters.
 *
 * To support a new bot list, extend this class and implement
 * `createRequest()` - return the URL, method, headers and body the
 * list's API expects. The base class handles JSON serialization,
 * the fetch call, and error reporting.
 */
export abstract class BotList {
	/** Machine-friendly unique key, e.g. "topgg". Used for logs and postNow(key). */
	abstract readonly key: string;
	/** Human-friendly name, e.g. "Top.gg". */
	abstract readonly name: string;
	/** Set to true if this list's API needs the bot's Discord client ID in the URL. */
	readonly requiresBotId: boolean = false;

	readonly token: string;
	readonly interval?: number;

	constructor(options: BotListOptions) {
		if (!options?.token || typeof options.token !== "string") {
			throw new TypeError(`A non-empty string "token" is required for ${this.constructor.name}.`);
		}
		if (options.interval !== undefined && (!Number.isFinite(options.interval) || options.interval <= 0)) {
			throw new TypeError(`"interval" for ${this.constructor.name} must be a positive number of milliseconds.`);
		}
		this.token = options.token;
		this.interval = options.interval;
	}

	/** Build the HTTP request for this list from the current stats. */
	protected abstract createRequest(stats: BotStats, context: PostContext): HttpRequestSpec;

	/**
	 * Posts the given stats to this bot list.
	 * Resolves on success, throws `BotListError` on a non-2xx response.
	 */
	async post(stats: BotStats, context: PostContext = {}): Promise<void> {
		if (this.requiresBotId && !context.botId) {
			throw new TypeError(`${this.name} requires the bot's Discord client ID. Pass "botId" to the StatsPoster options.`);
		}

		const spec = this.createRequest(stats, context);
		const headers: Record<string, string> = { ...spec.headers };
		let body: string | undefined;

		if (spec.body !== undefined) {
			headers["Content-Type"] ??= "application/json";
			body = JSON.stringify(spec.body);
		}

		const response = await fetch(spec.url, { method: spec.method, headers, body });

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new BotListError(this.key, response.status, text);
		}
		// Drain the body so the connection can be reused (some runtimes require this).
		await response.body?.cancel().catch(() => {});
	}
}
