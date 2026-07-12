import { BotList } from "../bot-list.js";
import type { BotStats, HttpRequestSpec, PostContext } from "../types.js";

/**
 * Top.gg - https://top.gg
 *
 * API: PATCH https://top.gg/api/v1/projects/@me/metrics
 * Auth: Authorization: Bearer <token>
 * Supported fields: server_count, shard_count
 * Success: 204 No Content
 */
export class TopGG extends BotList {
	readonly key = "topgg";
	readonly name = "Top.gg";

	protected createRequest(stats: BotStats, _context: PostContext): HttpRequestSpec {
		const body: Record<string, number> = { server_count: stats.guildCount };
		if (stats.shardCount !== undefined) body.shard_count = stats.shardCount;

		return {
			url: "https://top.gg/api/v1/projects/@me/metrics",
			method: "PATCH",
			headers: { Authorization: `Bearer ${this.token}` },
			body,
		};
	}
}
