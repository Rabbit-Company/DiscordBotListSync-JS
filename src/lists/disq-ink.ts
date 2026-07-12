import { BotList } from "../bot-list.js";
import type { BotStats, HttpRequestSpec, PostContext } from "../types.js";

/**
 * Disq - https://disq.ink
 *
 * API: POST https://api.disq.ink/v1/bots/:id
 * Auth: Authorization: <token>
 * Supported fields: serverCount, shards
 * Success: 200 { "status": 200, "message": "Successfully updated your bot stats." }
 */
export class DisqInk extends BotList {
	readonly key = "disqink";
	readonly name = "Disq.ink";
	override readonly requiresBotId = true;

	protected createRequest(stats: BotStats, context: PostContext): HttpRequestSpec {
		const body: Record<string, number> = { serverCount: stats.guildCount };

		return {
			url: `https://api.disq.ink/v1/bots/${context.botId}`,
			method: "POST",
			headers: { Authorization: this.token },
			body,
		};
	}
}
