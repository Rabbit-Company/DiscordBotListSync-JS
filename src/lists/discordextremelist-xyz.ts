import { BotList } from "../bot-list.js";
import type { BotStats, HttpRequestSpec, PostContext } from "../types.js";

/**
 * Discord Extreme List - https://discordextremelist.xyz
 *
 * API: POST https://api.discordextremelist.xyz/v2/bot/:id/stats
 * Auth: Authorization: Bearer <token>
 * Supported fields: guildCount, shardCount
 * Success: 200 { "error": false, "status": 200, "guildCount": 0, "shardCount": 0 }
 */
export class DiscordExtremeListXyz extends BotList {
	readonly key = "discordextremelistxyz";
	readonly name = "DiscordExtremeList.xyz";
	override readonly requiresBotId = true;

	protected createRequest(stats: BotStats, context: PostContext): HttpRequestSpec {
		const body: Record<string, number> = { guildCount: stats.guildCount };
		if (stats.shardCount !== undefined) body.shardCount = stats.shardCount;

		return {
			url: `https://api.discordextremelist.xyz/v2/bot/${context.botId}/stats`,
			method: "POST",
			headers: { Authorization: this.token },
			body,
		};
	}
}
