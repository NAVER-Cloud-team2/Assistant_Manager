/**
 * 서버 흐름 연결 테스트 — 담당: D
 * 행사 생성 → 가린 줄 전송 → 초안 → 발행 → 결과 링크 → 모두 지우기 (가짜 모드)
 */
import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { POST as createEvent } from "@/app/api/events/route";
import { DELETE as deleteEvent } from "@/app/api/events/[id]/route";
import { POST as postAnswers } from "@/app/api/events/[id]/answers/route";
import { GET as getDraft } from "@/app/api/events/[id]/draft/route";
import { POST as postExcerpt } from "@/app/api/events/[id]/excerpt/route";
import { POST as publish } from "@/app/api/events/[id]/publish/route";
import { GET as getResult } from "@/app/api/r/[token]/route";
import { ADMIN_HEADER, type CreateEventResponse, type PublishResponse } from "@/lib/api";
import { CryptoError, type Sealed } from "@/lib/crypto";
import { garam4 } from "@/lib/fixture";
import { getStore, keys } from "@/lib/store";
import type { Draft, ResultView } from "@/lib/types";

const CANARY = "CANARY-9B2E 2차 노래방 31,007원";
const DAY_MS = 24 * 60 * 60 * 1000;

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://test.local", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const params = <T>(v: T) => ({ params: Promise.resolve(v) });

async function newEventWithExcerpt() {
  const created = (await (await createEvent(json({ name: garam4.eventName, roster: garam4.roster }))).json()) as CreateEventResponse;
  const auth = { [ADMIN_HEADER]: created.adminToken };
  const res = await postExcerpt(json({ lines: garam4.masked }, auth), params({ id: created.eventId }));
  expect(res.status).toBe(200);
  return { id: created.eventId, auth };
}

/** MemoryStore 내부 항목(값·만료 시각)을 직접 본다 — TTL 갱신 여부 확인용 */
type Entry = { value: unknown; expiresAt: number };
function memoryEntry(key: string): Entry {
  const map = (globalThis as unknown as { __daechongStore: Map<string, Entry> }).__daechongStore;
  const e = map.get(key);
  if (!e) throw new Error(`저장소에 ${key} 없음`);
  return e;
}
function snapshot(id: string) {
  const pick = (k: string) => {
    const e = memoryEntry(k);
    return { value: structuredClone(e.value) as Sealed, expiresAt: e.expiresAt };
  };
  return { excerpt: pick(keys.excerpt(id)), extract: pick(keys.extract(id)), confirm: pick(keys.confirm(id)) };
}

/** console 출력(=서버 로그)을 모아 원문이 새는지 본다 */
function captureConsole() {
  const chunks: string[] = [];
  const spies = (["log", "info", "warn", "error"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      chunks.push(args.map((a) => (a instanceof Error ? `${a} ${a.stack}` : String(a))).join(" "));
    }),
  );
  return { text: () => chunks.join("\n"), restore: () => spies.forEach((s) => s.mockRestore()) };
}

describe("API 흐름 (가짜 모드)", () => {
  it("붙여넣기부터 결과 링크까지", async () => {
    const created = (await (await createEvent(json({ name: garam4.eventName, roster: garam4.roster }))).json()) as CreateEventResponse;
    const auth = { [ADMIN_HEADER]: created.adminToken };

    const draftRes = await postExcerpt(json({ lines: garam4.masked }, auth), params({ id: created.eventId }));
    expect(draftRes.status).toBe(200);
    const draft = (await draftRes.json()) as Draft;
    expect(draft.publishable).toBe(true);
    expect(draft.aiDraft).toBe(true);

    const pubRes = await publish(json({ priorShared: "없음" }, auth), params({ id: created.eventId }));
    const { version } = (await pubRes.json()) as PublishResponse;
    expect(version.n).toBe(1);
    expect(version.message).toContain("다온 → 가람 22,000원");

    const result = (await (await getResult(new Request("http://test.local"), params({ token: created.resultToken }))).json()) as ResultView;
    const raon = result.people.find((p) => p.alias === "라온");
    expect(raon?.total).toBe(12000);
    // 결과 페이지에는 원 발언이 없어야 한다
    const body = JSON.stringify(result);
    for (const line of garam4.masked) expect(body).not.toContain(line.text);

    const del = await deleteEvent(new Request("http://test.local", { method: "DELETE", headers: auth }), params({ id: created.eventId }));
    expect(del.status).toBe(200);
    const gone = await getResult(new Request("http://test.local"), params({ token: created.resultToken }));
    expect(gone.status).toBe(404);
  });

  it("ENCRYPTION_KEY가 있으면 원문 계열 키를 암호화해 저장하고, 흐름은 그대로 동작", async () => {
    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    try {
      const created = (await (await createEvent(json({ name: garam4.eventName, roster: garam4.roster }))).json()) as CreateEventResponse;
      const auth = { [ADMIN_HEADER]: created.adminToken };
      const draftRes = await postExcerpt(json({ lines: garam4.masked }, auth), params({ id: created.eventId }));
      expect(draftRes.status).toBe(200);

      const store = getStore();
      for (const key of [keys.excerpt(created.eventId), keys.extract(created.eventId), keys.confirm(created.eventId)]) {
        const sealed = await store.get<Sealed>(key);
        expect(sealed?.alg).toBe("aes-256-gcm");
        const raw = JSON.stringify(sealed);
        for (const line of garam4.masked) expect(raw).not.toContain(line.text);
      }

      const pubRes = await publish(json({ priorShared: "없음" }, auth), params({ id: created.eventId }));
      expect(pubRes.status).toBe(200);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("POST /answers는 기존 암호문을 검증한 뒤 confirm을 새로 암호화하고 TTL을 다시 건다", async () => {
    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
      const { id, auth } = await newEventWithExcerpt();
      const before = snapshot(id);

      vi.setSystemTime(new Date("2026-11-03T00:00:00Z"));
      const res = await postAnswers(json({ answers: [], manualItems: [], lineOverrides: {} }, auth), params({ id }));
      expect(res.status).toBe(200);
      const draft = (await res.json()) as Draft;
      expect(draft.lines.map((l) => l.text)).toEqual(garam4.masked.map((l) => l.text));

      const after = snapshot(id);
      // confirm: 새 iv로 다시 암호화
      expect(after.confirm.value.alg).toBe("aes-256-gcm");
      expect(after.confirm.value.data).not.toBe(before.confirm.value.data);
      // excerpt·extract: 같은 암호문을 그대로 다시 쓴다
      expect(after.excerpt.value).toEqual(before.excerpt.value);
      expect(after.extract.value).toEqual(before.extract.value);
      // 세 키 모두 TTL이 2일만큼 연장됨
      for (const k of ["excerpt", "extract", "confirm"] as const) {
        expect(after[k].expiresAt - before[k].expiresAt).toBe(2 * DAY_MS);
      }
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it("저장된 암호문이 변조됐으면 POST /answers가 실패하고 TTL·confirm을 건드리지 않는다", async () => {
    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
      const { id, auth } = await newEventWithExcerpt();
      const entry = memoryEntry(keys.excerpt(id));
      const sealed = entry.value as Sealed;
      const buf = Buffer.from(sealed.data, "base64");
      buf[buf.length - 1] ^= 0x01;
      entry.value = { alg: sealed.alg, data: buf.toString("base64") };
      const before = snapshot(id);

      vi.setSystemTime(new Date("2026-11-03T00:00:00Z"));
      await expect(postAnswers(json({ answers: [], manualItems: [] }, auth), params({ id }))).rejects.toThrow(CryptoError);
      expect(snapshot(id)).toEqual(before);
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it("운영(NODE_ENV=production)에서 키가 없으면 원문 계열을 저장하지 않고, 오류·로그에 CANARY가 없다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORE", "memory");
    vi.stubEnv("ENCRYPTION_KEY", "");
    const out = captureConsole();
    try {
      const created = (await (await createEvent(json({ name: "x", roster: garam4.roster }))).json()) as CreateEventResponse;
      const auth = { [ADMIN_HEADER]: created.adminToken };
      const lines = [...garam4.masked, { no: "99", speaker: "가람", text: CANARY }];
      const err = await postExcerpt(json({ lines }, auth), params({ id: created.eventId })).then(
        () => null,
        (e: unknown) => e as Error,
      );
      expect(err).toBeInstanceOf(CryptoError);
      expect(`${err} ${err?.stack}`).not.toContain("CANARY");
      for (const k of [keys.excerpt, keys.extract, keys.confirm]) {
        expect(await getStore().get(k(created.eventId))).toBeNull();
      }
      expect(out.text()).not.toContain("CANARY");
    } finally {
      out.restore();
      vi.unstubAllEnvs();
    }
  });

  it("손상된 평문 레코드(개발 모드)는 CryptoError, 오류·로그에 CANARY가 없다", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    const out = captureConsole();
    try {
      const { id, auth } = await newEventWithExcerpt();
      memoryEntry(keys.excerpt(id)).value = { alg: "none", data: `[{"no":"01","text":"${CANARY}` };
      const get = new Request("http://test.local", { headers: auth });
      const err = await getDraft(get, params({ id })).then(
        () => null,
        (e: unknown) => e as Error,
      );
      expect(err).toBeInstanceOf(CryptoError);
      expect(`${err} ${err?.stack}`).not.toContain("CANARY");
      await expect(postAnswers(json({ answers: [], manualItems: [] }, auth), params({ id }))).rejects.toThrow(CryptoError);
      expect(out.text()).not.toContain("CANARY");
    } finally {
      out.restore();
      vi.unstubAllEnvs();
    }
  });

  it("관리 토큰이 틀리면 거절", async () => {
    const created = (await (await createEvent(json({ name: "x", roster: ["가", "나"] }))).json()) as CreateEventResponse;
    const res = await postExcerpt(json({ lines: garam4.masked }, { [ADMIN_HEADER]: "wrong" }), params({ id: created.eventId }));
    expect(res.status).toBe(403);
  });
});
