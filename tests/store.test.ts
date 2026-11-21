/**
 * RedisStore 테스트 — 담당: D.
 * 로컬·CI에는 Redis가 없으므로, Redis 프로토콜(RESP2)로 GET·SET EX·DEL만 흉내 내는 가짜 서버를 띄워 검증한다.
 * 마지막 테스트는 STORE=redis + ENCRYPTION_KEY로 API 흐름 전체를 이 가짜 서버에 붙여 돌린다.
 */
import { randomBytes } from "node:crypto";
import { createServer, type Server, type Socket } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { RedisStore, StoreError, TTL } from "@/lib/store";

type Stored = { value: string; ex: number | null };

/** 아주 작은 가짜 Redis. 받은 명령과 저장 값(+EX)을 기록한다. */
function startFakeRedis(): Promise<{ url: string; data: Map<string, Stored>; commands: string[][]; server: Server }> {
  const data = new Map<string, Stored>();
  const commands: string[][] = [];
  const bulk = (s: string) => `$${Buffer.byteLength(s)}\r\n${s}\r\n`;

  const reply = (args: string[]): string => {
    const [cmd, ...rest] = args;
    switch (cmd.toUpperCase()) {
      case "INFO":
        return bulk("# Server\r\nredis_version:7.2.0\r\nloading:0\r\n");
      case "PING":
        return "+PONG\r\n";
      case "GET": {
        const e = data.get(rest[0]);
        return e ? bulk(e.value) : "$-1\r\n";
      }
      case "SET": {
        const [k, v, ...opts] = rest;
        const i = opts.findIndex((o) => o.toUpperCase() === "EX");
        data.set(k, { value: v, ex: i >= 0 ? Number(opts[i + 1]) : null });
        return "+OK\r\n";
      }
      case "DEL": {
        let n = 0;
        for (const k of rest) if (data.delete(k)) n++;
        return `:${n}\r\n`;
      }
      default:
        return "+OK\r\n"; // QUIT·CLIENT 등
    }
  };

  // RESP 배열 명령 파서 (조각난 패킷도 처리)
  const handle = (sock: Socket) => {
    let buf = Buffer.alloc(0);
    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf[0] !== 0x2a /* * */) return;
        let pos = buf.indexOf("\r\n");
        if (pos < 0) return;
        const n = Number(buf.subarray(1, pos).toString());
        let p = pos + 2;
        const args: string[] = [];
        for (let i = 0; i < n; i++) {
          const end = buf.indexOf("\r\n", p);
          if (end < 0) return;
          const len = Number(buf.subarray(p + 1, end).toString());
          const start = end + 2;
          if (buf.length < start + len + 2) return;
          args.push(buf.subarray(start, start + len).toString("utf8"));
          p = start + len + 2;
        }
        buf = buf.subarray(p);
        commands.push(args);
        sock.write(reply(args));
        if (args[0].toUpperCase() === "QUIT") sock.end();
        pos = 0;
      }
    });
  };

  const server = createServer(handle);
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      resolve({ url: `redis://127.0.0.1:${port}`, data, commands, server });
    }),
  );
}

describe("RedisStore (가짜 Redis)", () => {
  let fake: Awaited<ReturnType<typeof startFakeRedis>>;
  let store: RedisStore;

  beforeAll(async () => {
    fake = await startFakeRedis();
    store = new RedisStore(fake.url);
  });
  afterAll(async () => {
    await store.close();
    fake.server.close();
  });

  it("값을 JSON 문자열로 저장하고 TTL을 SET ... EX로 건다", async () => {
    const value = { name: "동아리 뒤풀이", roster: ["가람", "보람"], n: 1 };
    await store.set("event:abc", value, TTL.result);
    expect(fake.data.get("event:abc")).toEqual({ value: JSON.stringify(value), ex: TTL.result });
    expect(await store.get("event:abc")).toEqual(value);
  });

  it("없는 키는 null", async () => {
    expect(await store.get("event:none")).toBeNull();
  });

  it("TTL은 1 이상의 정수 초로 올림", async () => {
    await store.set("k:frac", 1, 1.2);
    await store.set("k:zero", 1, 0);
    expect(fake.data.get("k:frac")?.ex).toBe(2);
    expect(fake.data.get("k:zero")?.ex).toBe(1);
  });

  it("여러 키를 한 번에 지우고, 지울 키가 없으면 명령을 보내지 않는다", async () => {
    await store.set("d:1", 1, 60);
    await store.set("d:2", 2, 60);
    await store.del("d:1", "d:2");
    expect(fake.data.has("d:1") || fake.data.has("d:2")).toBe(false);
    const before = fake.commands.length;
    await store.del();
    expect(fake.commands.length).toBe(before);
  });

  it("저장 값이 JSON이 아니면 StoreError, 메시지에 값이 들어가지 않는다", async () => {
    fake.data.set("bad", { value: "CANARY-STORE 깨진 값", ex: null });
    const e = await store.get("bad").catch((x: Error) => x);
    expect(e).toBeInstanceOf(StoreError);
    expect(`${e} ${(e as Error).stack}`).not.toContain("CANARY");
  });
});

describe("RedisStore 설정·연결 오류", () => {
  it("REDIS_URL이 없으면 만들 때 오류", () => {
    expect(() => new RedisStore("")).toThrow(/REDIS_URL/);
  });

  it("Redis에 닿지 않으면 요청이 매달리지 않고 실패한다 (주소·비밀번호를 오류·로그에 남기지 않음)", async () => {
    const out: string[] = [];
    const spy = vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void out.push(a.join(" ")));
    // 열려 있지 않은 포트 + 가짜 비밀번호
    const s = new RedisStore("redis://:SECRET-PW-123@127.0.0.1:1");
    try {
      const e = await s.get("x").catch((x: Error) => x);
      expect(e).toBeInstanceOf(Error);
      expect(out.join("\n")).not.toContain("SECRET-PW-123");
      expect(out.join("\n")).toContain("redis_error");
    } finally {
      await s.close();
      spy.mockRestore();
    }
  }, 15_000);
});

describe("API 흐름 — STORE=redis + 암호화 (가짜 Redis)", () => {
  let fake: Awaited<ReturnType<typeof startFakeRedis>>;
  const CANARY = "CANARY-REDIS-FLOW 원문 노출 검사";

  beforeAll(async () => {
    fake = await startFakeRedis();
    vi.stubEnv("STORE", "redis");
    vi.stubEnv("REDIS_URL", fake.url);
    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
  });
  afterAll(async () => {
    const { getStore } = await import("@/lib/store");
    await (getStore() as RedisStore).close();
    vi.unstubAllEnvs();
    fake.server.close();
  });

  it("행사 생성 → 발췌 → 발행 → 결과 조회 → 모두 지우기가 Redis 위에서 동작하고, 원문 계열은 암호문·TTL 7일로 저장된다", async () => {
    // getStore()가 위 환경 변수로 처음 만들어지도록 테스트 안에서 불러온다
    const { POST: createEvent } = await import("@/app/api/events/route");
    const { POST: postExcerpt } = await import("@/app/api/events/[id]/excerpt/route");
    const { POST: publish } = await import("@/app/api/events/[id]/publish/route");
    const { DELETE: deleteEvent } = await import("@/app/api/events/[id]/route");
    const { GET: getResult } = await import("@/app/api/r/[token]/route");
    const { ADMIN_HEADER } = await import("@/lib/api");
    const { garam4 } = await import("@/lib/fixture");
    const { getStore, keys } = await import("@/lib/store");
    expect(getStore()).toBeInstanceOf(RedisStore);

    const json = (body: unknown, headers: Record<string, string> = {}) =>
      new Request("http://test.local", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    const params = <T>(v: T) => ({ params: Promise.resolve(v) });

    const created = (await (await createEvent(json({ name: garam4.eventName, roster: garam4.roster }))).json()) as {
      eventId: string;
      adminToken: string;
      resultToken: string;
    };
    const id = created.eventId;
    const auth = { [ADMIN_HEADER]: created.adminToken };
    const lines = [...garam4.masked, { no: "99", speaker: garam4.roster[0], text: CANARY }];
    expect((await postExcerpt(json({ lines }, auth), params({ id }))).status).toBe(200);
    expect((await publish(json({ priorShared: "없음" }, auth), params({ id }))).status).toBe(200);

    const res = await getResult(new Request("http://test.local"), params({ token: created.resultToken }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { version: number }).version).toBe(1);

    // 원문 계열: 암호문 + 7일, 결과 계열: 30일
    for (const k of [keys.excerpt(id), keys.extract(id), keys.confirm(id)]) {
      const e = fake.data.get(k)!;
      expect(JSON.parse(e.value).alg).toBe("aes-256-gcm");
      expect(e.ex).toBe(TTL.source);
    }
    for (const k of [keys.event(id), keys.version(id, 1), keys.latestVersion(id)]) expect(fake.data.get(k)?.ex).toBe(TTL.result);
    // Redis 어디에도 원문(CANARY·발췌 문장)이 없다
    const dump = [...fake.data.values()].map((e) => e.value).join("\n");
    expect(dump).not.toContain("CANARY");
    for (const l of garam4.masked) expect(dump).not.toContain(l.text);
    // 토큰은 해시로만 저장
    expect([...fake.data.keys()].join("\n")).not.toContain(created.adminToken);

    // 모두 지우기 → 이 행사의 키(토큰 해시 키 포함)가 Redis에서 하나도 남지 않음. 이 가짜 Redis는 이 흐름만 쓴다.
    const del = await deleteEvent(new Request("http://test.local", { method: "DELETE", headers: auth }), params({ id }));
    expect(del.status).toBe(200);
    expect([...fake.data.keys()]).toEqual([]);
    expect((await getResult(new Request("http://test.local"), params({ token: created.resultToken }))).status).toBe(404);
  });
});
