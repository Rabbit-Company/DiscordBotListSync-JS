# DiscordBotListSync-JS

Periodically post your Discord bot's stats (guild count, user count, shard count) to bot list websites. Bring your tokens, get a `getStats` function ready, and the library handles scheduling, request formats, and error isolation for every supported list.

- **Runtime-agnostic** - works on Node.js (>= 18), Bun and Deno. Uses only web-standard `fetch` and timers, zero runtime dependencies.
- **Library-agnostic** - works with discord.js, Eris, Oceanic, or anything else; you just supply the numbers.
- **Global + per-list intervals** - defaults to every 10 minutes, each list can override it.
- **Fault-tolerant** - one list failing (bad token, downtime) never affects the others or crashes your bot.
- **Easily extensible** - a new bot list adapter is ~15 lines of code.

## Supported bot lists

| List                                                     | Class                   | Fields sent                                       | Needs `botId`? |
| -------------------------------------------------------- | ----------------------- | ------------------------------------------------- | -------------- |
| [Top.gg](https://top.gg)                                 | `TopGG`                 | `server_count`, `shard_count`                     | No             |
| [Discords.com](https://discords.com)                     | `DiscordsCom`           | `server_count`                                    | Yes            |
| [DiscordBotList.com](https://discordbotlist.com)         | `DiscordBotListCom`     | `server_count`, `user_count`, `voice_connections` | Yes            |
| [DiscordExtremeList.xyz](https://discordextremelist.xyz) | `DiscordExtremeListXyz` | `server_count`, `shard_count`                     | Yes            |

## Install

```bash
# Bun
bun add @rabbit-company/discord-bot-list-sync
# npm / pnpm / yarn
npm install @rabbit-company/discord-bot-list-sync
```

Deno can import it via `npm:` specifiers: `import { StatsPoster } from "npm:@rabbit-company/discord-bot-list-sync";`

## Quick start (discord.js example)

```ts
import { Client, GatewayIntentBits } from "discord.js";
import { StatsPoster, TopGG, DiscordsCom } from "@rabbit-company/discord-bot-list-sync";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const poster = new StatsPoster({
	botId: process.env.DISCORD_CLIENT_ID, // needed by Discords.com
	interval: 10 * 60 * 1000, // global default: 10 minutes (this is also the built-in default)
	getStats: () => ({
		guildCount: client.guilds.cache.size,
		userCount: client.guilds.cache.reduce((acc, g) => acc + (g.memberCount ?? 0), 0),
		shardCount: client.shard?.count ?? 1,
	}),
	lists: [
		new TopGG({ token: process.env.TOPGG_TOKEN! }),
		// Per-list interval override: post to Discords.com every 30 minutes instead
		new DiscordsCom({ token: process.env.DISCORDS_TOKEN!, interval: 30 * 60 * 1000 }),
	],
	onPost: (list, stats) => console.log(`[stats] posted ${stats.guildCount} guilds to ${list.name}`),
	onError: (list, error) => console.error(`[stats] failed to post to ${list.name}:`, error),
});

client.once("clientReady", () => poster.start()); // "ready" on discord.js v14 and older

// Optional: push fresh numbers immediately after important events
client.on("guildCreate", () => void poster.postNow());
client.on("guildDelete", () => void poster.postNow());
```

## API

### `new StatsPoster(options)`

| Option        | Type                                  | Default           | Description                                                                                  |
| ------------- | ------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `lists`       | `BotList[]`                           | - (required)      | The bot list adapters to post to.                                                            |
| `getStats`    | `() => BotStats \| Promise<BotStats>` | - (required)      | Called on every cycle to collect current stats.                                              |
| `botId`       | `string`                              | `undefined`       | Your bot's Discord application/client ID. Required if any list needs it (e.g. Discords.com). |
| `interval`    | `number` (ms)                         | `600000` (10 min) | Global posting interval.                                                                     |
| `postOnStart` | `boolean`                             | `true`            | Post once immediately when `start()` is called.                                              |
| `onPost`      | `(list, stats) => void`               | `undefined`       | Success callback.                                                                            |
| `onError`     | `(list, error) => void`               | `undefined`       | Failure callback. HTTP failures throw `BotListError` with `.status` and `.responseBody`.     |

### Methods

- **`poster.start()`** - starts one timer per list (per-list `interval` wins over the global one). Timers are `unref`'d on Node/Bun so they won't keep a dying process alive.
- **`poster.stop()`** - clears all timers. `start()` can be called again later.
- **`poster.postNow(key?)`** - posts immediately to all lists, or only to the list with the given key (e.g. `"topgg"`). Returns `Promise<Map<string, { ok: boolean; error?: unknown }>>` so you can inspect per-list results. Never throws for HTTP errors.
- **`poster.running`** - `true` while timers are active.

### `BotStats`

```ts
interface BotStats {
	guildCount: number; // required
	userCount?: number;
	shardCount?: number;
	voiceConnectionCount?: number;
}
```

Provide everything you can - each adapter picks only the fields its API supports.

## Adding a new bot list

Extend `BotList` and implement `createRequest()`. The base class handles JSON serialization, the fetch call, non-2xx error handling, and the `requiresBotId` guard.

```ts
// src/lists/example-list.ts
import { BotList } from "../bot-list.js";
import type { BotStats, HttpRequestSpec, PostContext } from "../types.js";

/**
 * ExampleList - https://example-botlist.com
 * API: POST https://api.example-botlist.com/bots/:id/stats
 * Auth: Authorization: <token>
 */
export class ExampleList extends BotList {
	readonly key = "examplelist"; // unique, lowercase, used in logs & postNow(key)
	readonly name = "ExampleList";
	override readonly requiresBotId = true; // only if the URL/body needs the bot's client ID

	protected createRequest(stats: BotStats, context: PostContext): HttpRequestSpec {
		return {
			url: `https://api.example-botlist.com/bots/${context.botId}/stats`,
			method: "POST",
			headers: { Authorization: this.token },
			body: {
				guilds: stats.guildCount,
				users: stats.userCount, // undefined fields are dropped by JSON.stringify
				shards: stats.shardCount,
			},
		};
	}
}
```

Then export it from `src/lists/index.ts`:

```ts
export { ExampleList } from "./example-list.js";
```

That's it - it automatically gets scheduling, per-list intervals, callbacks, and error handling. Add a small test in `tests/` mirroring the existing ones to lock in the request shape.

## Development

```bash
bun install       # install dev dependencies
bun test          # run the test suite (fetch is mocked - no real requests)
bun run typecheck # strict TypeScript check
bun run build     # emit dist/ (ESM JS + .d.ts)
```

## License

MIT
