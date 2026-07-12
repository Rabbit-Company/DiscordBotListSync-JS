import { BotList } from "../bot-list.js";
import type { BotStats, HttpRequestSpec, PostContext } from "../types.js";

/**
 * Dlist.space - https://dlist.space
 *
 * API: POST https://api.dlist.space/api/bot/:id/stats
 * Auth: Authorization: <token>
 * Supported fields: server_count, user_count, shard_count
 * Success: 200 { "status": 200, "message": "Stats updated" }
 */
export class DlistSpace extends BotList {
	readonly key = "dlistspace";
	readonly name = "Dlist.space";
	override readonly requiresBotId = true;

	protected createRequest(stats: BotStats, context: PostContext): HttpRequestSpec {
		const body: Record<string, number> = { server_count: stats.guildCount };
		if (stats.userCount !== undefined) body.user_count = stats.userCount;
		if (stats.shardCount !== undefined) body.shard_count = stats.shardCount;

		return {
			url: `https://api.dlist.space/api/bot/${context.botId}/stats`,
			method: "POST",
			headers: { Authorization: this.token },
			body,
		};
	}
}
