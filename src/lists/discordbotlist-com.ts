import { BotList } from "../bot-list.js";
import type { BotStats, HttpRequestSpec, PostContext } from "../types.js";

/**
 * Discord Bot List - https://discordbotlist.com
 *
 * API: POST https://discordbotlist.com/api/v1/bots/:id/stats
 * Auth: Authorization: Bearer <token>
 * Supported fields: shard_id, guilds, users, voice_connections
 * Success: 200 { "success": true }
 */
export class DiscordBotListCom extends BotList {
	readonly key = "discordbotlistcom";
	readonly name = "DiscordBotList.com";
	override readonly requiresBotId = true;

	protected createRequest(stats: BotStats, context: PostContext): HttpRequestSpec {
		const body: Record<string, number> = { guilds: stats.guildCount };
		if (stats.userCount !== undefined) body.users = stats.userCount;
		if (stats.voiceConnectionCount !== undefined) body.voice_connections = stats.voiceConnectionCount;

		return {
			url: `https://discordbotlist.com/api/v1/bots/${context.botId}/stats`,
			method: "POST",
			headers: { Authorization: `Bearer ${this.token}` },
			body,
		};
	}
}
