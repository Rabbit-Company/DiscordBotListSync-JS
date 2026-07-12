import { BotList } from "../bot-list.js";
import type { BotStats, HttpRequestSpec, PostContext } from "../types.js";

/**
 * Radarcord - https://radar.cpdv.net
 *
 * API: POST https://api.radarcord.net/bot/:id/stats
 * Auth: Authorization: <token>
 * Supported fields: guilds, shards
 * Success: 200 { message: "Success" }
 */
export class RadarcordNet extends BotList {
	readonly key = "radarcordnet";
	readonly name = "Radarcord.net";
	override readonly requiresBotId = true;

	protected createRequest(stats: BotStats, context: PostContext): HttpRequestSpec {
		const body: Record<string, number> = { guilds: stats.guildCount };
		if (stats.shardCount !== undefined) body.shards = stats.shardCount;

		return {
			url: `https://api.radarcord.net/bot/${context.botId}/stats`,
			method: "POST",
			headers: { Authorization: this.token },
			body,
		};
	}
}
