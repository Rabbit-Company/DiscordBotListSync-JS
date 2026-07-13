import { BotList } from "../bot-list.js";
import type { BotStats, HttpRequestSpec, PostContext } from "../types.js";

/**
 * Discord Bots GG - https://discord.bots.gg
 *
 * API: POST https://discord.bots.gg/api/v1/bots/:id/stats
 * Auth: Authorization: <token>
 * Supported fields: guildCount, shardCount, shardId
 * Success: 200 { "shardCount": 1, "guildCount": 10 }
 */
export class DiscordBotsGG extends BotList {
	readonly key = "discordbotsgg";
	readonly name = "Discord-Bots.gg";
	override readonly requiresBotId = true;

	protected createRequest(stats: BotStats, context: PostContext): HttpRequestSpec {
		const body: Record<string, number> = { guildCount: stats.guildCount };
		if (stats.shardCount !== undefined) body.shardCount = stats.shardCount;

		return {
			url: `https://discord.bots.gg/api/v1/bots/${context.botId}/stats`,
			method: "POST",
			headers: { Authorization: this.token },
			body,
		};
	}
}
