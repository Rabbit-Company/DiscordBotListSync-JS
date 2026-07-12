import { afterEach, describe, expect, it } from "bun:test";
import { BotListError, DiscordsCom, StatsPoster, TopGG } from "../src/index";

interface CapturedRequest {
  url: string;
  method?: string;
  headers: Record<string, string>;
  body?: string;
}

const realFetch = globalThis.fetch;

function mockFetch(
  handler: (req: CapturedRequest) => Response | Promise<Response>,
): CapturedRequest[] {
  const calls: CapturedRequest[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req: CapturedRequest = {
      url: String(input),
      method: init?.method,
      headers: (init?.headers as Record<string, string>) ?? {},
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(req);
    return handler(req);
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("TopGG adapter", () => {
  it("sends a PATCH with bearer auth, server_count and shard_count", async () => {
    const calls = mockFetch(() => new Response(null, { status: 204 }));
    const list = new TopGG({ token: "topgg-token" });

    await list.post({ guildCount: 420, shardCount: 67, userCount: 9999 });

    expect(calls.length).toBe(1);
    const call = calls[0]!;
    expect(call.url).toBe("https://top.gg/api/v1/projects/@me/metrics");
    expect(call.method).toBe("PATCH");
    expect(call.headers.Authorization).toBe("Bearer topgg-token");
    expect(call.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(call.body!)).toEqual({
      server_count: 420,
      shard_count: 67,
    });
  });

  it("omits shard_count when not provided", async () => {
    const calls = mockFetch(() => new Response(null, { status: 204 }));
    await new TopGG({ token: "t" }).post({ guildCount: 5 });
    expect(JSON.parse(calls[0]!.body!)).toEqual({ server_count: 5 });
  });

  it("throws BotListError with status and body on failure", async () => {
    mockFetch(() => new Response('{"error":"bad token"}', { status: 400 }));
    const err = await new TopGG({ token: "t" })
      .post({ guildCount: 1 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(BotListError);
    expect(err.status).toBe(400);
    expect(err.list).toBe("topgg");
    expect(err.responseBody).toContain("bad token");
  });
});

describe("DiscordsCom adapter", () => {
  it("sends a POST with raw token auth and the bot id in the URL", async () => {
    const calls = mockFetch(
      () => new Response('{"status":"success"}', { status: 200 }),
    );
    const list = new DiscordsCom({ token: "discords-token" });

    await list.post({ guildCount: 123, shardCount: 4 }, { botId: "111222333" });

    const call = calls[0]!;
    expect(call.url).toBe(
      "https://discords.com/bots/api/bot/111222333/setservers",
    );
    expect(call.method).toBe("POST");
    expect(call.headers.Authorization).toBe("discords-token");
    expect(JSON.parse(call.body!)).toEqual({ server_count: 123 });
  });

  it("refuses to post without a botId", async () => {
    mockFetch(() => new Response(null, { status: 200 }));
    const err = await new DiscordsCom({ token: "t" })
      .post({ guildCount: 1 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TypeError);
    expect(String(err)).toContain("client ID");
  });
});

describe("StatsPoster", () => {
  it("requires botId at construction if any list needs it", () => {
    expect(
      () =>
        new StatsPoster({
          lists: [new DiscordsCom({ token: "t" })],
          getStats: () => ({ guildCount: 1 }),
        }),
    ).toThrow(/botId/);
  });

  it("rejects duplicate lists", () => {
    expect(
      () =>
        new StatsPoster({
          lists: [new TopGG({ token: "a" }), new TopGG({ token: "b" })],
          getStats: () => ({ guildCount: 1 }),
        }),
    ).toThrow(/Duplicate/);
  });

  it("postNow posts to all lists and reports per-list results", async () => {
    const calls = mockFetch((req) =>
      req.url.includes("top.gg")
        ? new Response(null, { status: 204 })
        : new Response('{"message":"missing_authorization"}', { status: 401 }),
    );

    const posted: string[] = [];
    const failed: string[] = [];
    const poster = new StatsPoster({
      botId: "42",
      lists: [new TopGG({ token: "a" }), new DiscordsCom({ token: "bad" })],
      getStats: () => ({ guildCount: 7 }),
      onPost: (list) => posted.push(list.key),
      onError: (list) => failed.push(list.key),
    });

    const results = await poster.postNow();

    expect(calls.length).toBe(2);
    expect(results.get("topgg")?.ok).toBe(true);
    expect(results.get("discordscom")?.ok).toBe(false);
    expect(results.get("discordscom")?.error).toBeInstanceOf(BotListError);
    expect(posted).toEqual(["topgg"]);
    expect(failed).toEqual(["discordscom"]);
  });

  it("postNow(key) posts only to that list", async () => {
    const calls = mockFetch(() => new Response(null, { status: 204 }));
    const poster = new StatsPoster({
      botId: "42",
      lists: [new TopGG({ token: "a" }), new DiscordsCom({ token: "b" })],
      getStats: () => ({ guildCount: 7 }),
    });

    const results = await poster.postNow("topgg");
    expect(calls.length).toBe(1);
    expect(calls[0]!.url).toContain("top.gg");
    expect([...results.keys()]).toEqual(["topgg"]);
  });

  it("uses per-list intervals over the global one and posts on start", async () => {
    const calls = mockFetch(() => new Response(null, { status: 204 }));
    const poster = new StatsPoster({
      interval: 10_000, // global fallback (not reached in this test)
      lists: [new TopGG({ token: "a", interval: 30 })], // fast per-list override
      getStats: () => ({ guildCount: 1 }),
    });

    poster.start();
    expect(poster.running).toBe(true);
    await Bun.sleep(80); // initial post + ~2 timer ticks
    poster.stop();
    expect(poster.running).toBe(false);

    expect(calls.length).toBeGreaterThanOrEqual(3);
    const countAfterStop = calls.length;
    await Bun.sleep(60);
    expect(calls.length).toBe(countAfterStop); // no posts after stop()
  });

  it("keeps the timer alive when getStats throws (error goes to onError)", async () => {
    mockFetch(() => new Response(null, { status: 204 }));
    const errors: unknown[] = [];
    let call = 0;
    const poster = new StatsPoster({
      lists: [new TopGG({ token: "a", interval: 20 })],
      postOnStart: false,
      getStats: () => {
        call++;
        if (call === 1) throw new Error("boom");
        return { guildCount: 1 };
      },
      onError: (_l, e) => errors.push(e),
    });

    poster.start();
    await Bun.sleep(70);
    poster.stop();

    expect(errors.length).toBe(1);
    expect(call).toBeGreaterThanOrEqual(2); // recovered and kept ticking
  });
});
