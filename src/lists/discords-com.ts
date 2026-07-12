import { BotList } from "../bot-list.js";
import type { BotStats, HttpRequestSpec, PostContext } from "../types.js";

/**
 * Discords.com - https://discords.com
 *
 * API: POST https://discords.com/bots/api/bot/:id/setservers
 * Auth: Authorization: <token> (raw token, no "Bearer" prefix)
 * Supported fields: server_count
 * Success: 200 { message: "count_updated", status: "success" }
 *
 * Note: this list requires the bot's Discord client ID in the URL,
 * so `botId` must be provided in the StatsPoster options.
 */
export class DiscordsCom extends BotList {
	readonly key = "discordscom";
	readonly name = "Discords.com";
	override readonly requiresBotId = true;

	protected createRequest(stats: BotStats, context: PostContext): HttpRequestSpec {
		return {
			url: `https://discords.com/bots/api/bot/${context.botId}/setservers`,
			method: "POST",
			headers: { Authorization: this.token },
			body: { server_count: stats.guildCount },
		};
	}
}
