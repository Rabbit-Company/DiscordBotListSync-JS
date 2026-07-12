/**
 * The statistics snapshot your bot provides on every posting cycle.
 * Only `guildCount` is required - each bot list adapter picks the
 * fields it supports and ignores the rest.
 */
export interface BotStats {
	/** Number of guilds (servers) the bot is in. Required. */
	guildCount: number;
	/** Total number of users the bot can see. Optional. */
	userCount?: number;
	/** Number of shards the bot is running. Optional. */
	shardCount?: number;
	/** Number of active voice connections. Optional. */
	voiceConnectionCount?: number;
}

/**
 * Extra context passed to adapters when posting.
 * Some bot lists need the bot's Discord application/client ID in the URL.
 */
export interface PostContext {
	/** The bot's Discord application (client) ID, if provided to the poster. */
	botId?: string;
}

/**
 * A plain description of an HTTP request. Adapters return this from
 * `createRequest()` and the base class performs the actual fetch,
 * so adding a new bot list usually means writing ~15 lines of code.
 */
export interface HttpRequestSpec {
	url: string;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	headers?: Record<string, string>;
	/** JSON-serializable body. Serialized automatically with Content-Type: application/json. */
	body?: unknown;
}

/** A function that returns the current stats (sync or async). */
export type StatsProvider = () => BotStats | Promise<BotStats>;
