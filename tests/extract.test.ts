/** AI 추출 테스트 — 담당: B. 실제 AI는 부르지 않고 fetch를 가짜로 바꾼다. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractEvents, toEvents } from "@/lib/extract";
import { garam4 } from "@/lib/fixture";
import type { SettlementEvent } from "@/lib/types";

const { masked, roster, parsed, events } = garam4;

/** SettlementEvent → AI가 내는 평평한 모양 */
function flat(e: SettlementEvent) {
  const base = { id: null, payer: null, amount: null, item: null, split: [], target: [], who: null, what: null, full: null, reason: null };
  const t = "target" in e ? (Array.isArray(e.target) ? e.target : [e.target]) : [];
  switch (e.type) {
    case "payment":
      return { ...base, ...e };
    case "correct":
      return { ...base, type: e.type, line: e.line, target: t, ...e.set };
    case "refund":
      return { ...base, type: e.type, line: e.line, target: t, full: e.full, amount: e.amount ?? null };
    default:
      return { ...base, ...e, target: t };
  }
}

const aiEvents = { events: events.map(flat) };

function stubFetch(body: unknown, status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const gemini = (data: unknown, finishReason = "STOP") => ({
  candidates: [{ finishReason, content: { parts: [{ text: typeof data === "string" ? data : JSON.stringify(data) }] } }],
});
const openai = (data: unknown, extra: Record<string, unknown> = {}) => ({
  choices: [{ finish_reason: "stop", message: { content: JSON.stringify(data), refusal: null }, ...extra }],
});

beforeEach(() => {
  vi.stubEnv("MOCK_AI", "0");
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  vi.stubEnv("OPENAI_MODEL", "gpt-6-luna");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("extractEvents · Gemini", () => {
  it("기준 예시 응답을 사건 목록으로 바꾼다", async () => {
    const fetch = stubFetch(gemini(aiEvents));
    const r = await extractEvents(masked, roster, parsed);
    expect(r.events).toEqual(events);
    expect(r.ai).toBe(true);
    expect(r.model).toBe("gemini:gemini-3.1-flash-lite");

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/models/gemini-3.1-flash-lite:generateContent");
    expect(url).not.toContain("test-gemini-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-gemini-key");
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema).toBeDefined();
    expect(body.contents[0].parts[0].text).toContain("01 가람: 저녁 네 명 52,001원 내가 냈어");
  });

  it("AI가 사건을 내지 않은 줄은 정산 외로 채운다", async () => {
    const without05 = { events: events.filter((e) => e.line !== "05").map(flat) };
    stubFetch(gemini(without05));
    const r = await extractEvents(masked, roster, parsed);
    expect(r.events.filter((e) => e.line === "05")).toEqual([{ type: "not_settlement", line: "05" }]);
  });

  it("GEMINI_MODEL로 모델을 바꾼다", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-4-hydrogen");
    const fetch = stubFetch(gemini(aiEvents));
    await extractEvents(masked, roster, parsed);
    expect(String(fetch.mock.calls[0][0])).toContain("/models/gemini-4-hydrogen:");
  });

  it("출력이 잘리면 실패", async () => {
    stubFetch(gemini(aiEvents, "MAX_TOKENS"));
    await expect(extractEvents(masked, roster, parsed)).rejects.toThrow("truncated");
  });

  it("JSON이 아니면 실패", async () => {
    stubFetch(gemini("not json"));
    await expect(extractEvents(masked, roster, parsed)).rejects.toThrow("bad_json");
  });

  it("HTTP 오류면 실패", async () => {
    stubFetch({ error: {} }, 429);
    await expect(extractEvents(masked, roster, parsed)).rejects.toThrow("http_429");
  });

  it("503이면 한 번 다시 보낸다", async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 503 }));
    fetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(gemini(aiEvents))));
    vi.stubGlobal("fetch", fetch);
    const r = await extractEvents(masked, roster, parsed);
    expect(r.events).toEqual(events);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("다시 보내도 503이면 실패, 400은 다시 보내지 않는다", async () => {
    const f503 = stubFetch({}, 503);
    await expect(extractEvents(masked, roster, parsed)).rejects.toThrow("http_503");
    expect(f503).toHaveBeenCalledTimes(2);
    const f400 = stubFetch({}, 400);
    await expect(extractEvents(masked, roster, parsed)).rejects.toThrow("http_400");
    expect(f400).toHaveBeenCalledTimes(1);
  });

  it("키가 없으면 실패", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(extractEvents(masked, roster, parsed)).rejects.toThrow("no_key");
  });
});

describe("extractEvents · OpenAI", () => {
  beforeEach(() => vi.stubEnv("AI_PROVIDER", "openai"));

  it("OPENAI_MODEL이 비어 있으면 기본값 없이 실패 (lib/env.ts 약속)", async () => {
    vi.stubEnv("OPENAI_MODEL", "  ");
    const fetch = stubFetch(openai(aiEvents));
    await expect(extractEvents(masked, roster, parsed)).rejects.toThrow("no_model");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AI_PROVIDER가 없으면 OpenAI를 쓴다", async () => {
    vi.stubEnv("AI_PROVIDER", "");
    const fetch = stubFetch(openai(aiEvents));
    await extractEvents(masked, roster, parsed);
    expect(String(fetch.mock.calls[0][0])).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("기준 예시 응답을 사건 목록으로 바꾼다", async () => {
    const fetch = stubFetch(openai(aiEvents));
    const r = await extractEvents(masked, roster, parsed);
    expect(r.events).toEqual(events);
    expect(r.model).toBe("openai:gpt-6-luna");

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-openai-key");
    const body = JSON.parse(String(init.body));
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
  });

  it("거절(refusal)이면 실패", async () => {
    stubFetch(openai(aiEvents, { message: { content: null, refusal: "no" } }));
    await expect(extractEvents(masked, roster, parsed)).rejects.toThrow("refusal");
  });

  it("출력이 잘리면 실패", async () => {
    stubFetch(openai(aiEvents, { finish_reason: "length" }));
    await expect(extractEvents(masked, roster, parsed)).rejects.toThrow("truncated");
  });
});

describe("toEvents (응답 검사)", () => {
  const base = { id: null, payer: null, amount: null, item: null, split: [], target: [], who: null, what: null, full: null, reason: null };
  const P1 = { ...base, type: "payment", line: "01", id: "P1", payer: "가람", amount: 52001, item: "저녁", split: ["라온", "가람"] };

  it("분담자에서 중복·명단 밖 이름을 빼고 줄 번호는 두 자리로 맞춘다", () => {
    const { events } = toEvents({ events: [{ ...P1, line: "1", split: ["라온", "가람", "라온", "김가람"] }] }, masked, roster);
    expect(events).toEqual([{ type: "payment", id: "P1", line: "01", payer: "가람", amount: 52001, item: "저녁", split: ["라온", "가람"] }]);
  });

  it("후보가 둘이면 target을 배열로 남긴다 (Q-대상 질문은 조건 정리기 몫)", () => {
    const P2 = { ...P1, line: "02", id: "P2", payer: "보람", amount: 30002 };
    const correct = { ...base, type: "correct", line: "03", target: ["P1", "P2"], amount: 48000 };
    const { events } = toEvents({ events: [P1, P2, correct] }, masked, roster);
    expect(events[2]).toEqual({ type: "correct", line: "03", target: ["P1", "P2"], set: { amount: 48000 } });
  });

  it("항목 이름 없는 정정을 AI가 하나로 정해도 앞 결제를 모두 후보로 돌린다", () => {
    const v = garam4.variants.ambiguousTarget;
    const lines = masked.map((l) => (l.no === v.replaceLine.no ? v.replaceLine : l));
    const P2 = { ...P1, line: "02", id: "P2", payer: "보람", amount: 30002, item: "2차" };
    const P3 = { ...P1, line: "04", id: "P3", payer: "다온", amount: 12000, item: "택시" };
    const correct = { ...base, type: "correct", line: "03", target: ["P1"], amount: 48000 };
    const { events } = toEvents({ events: [P1, P2, correct, P3] }, lines, roster);
    // 03줄 앞의 결제(P1·P2)만 후보, 뒤에 나온 P3는 아님
    expect(events[2]).toEqual({ type: "correct", line: "03", target: v.expectQuestion.optionValues, set: { amount: 48000 } });
  });

  it("정정에서 원래 결제와 같은 값은 뺀다 (대상을 가리키려고 쓴 항목 이름)", () => {
    const correct = { ...base, type: "correct", line: "03", target: ["P1"], amount: 48001, item: "저녁" };
    const { events } = toEvents({ events: [P1, correct] }, masked, roster);
    expect(events[1]).toEqual({ type: "correct", line: "03", target: "P1", set: { amount: 48001 } });
  });

  it("조건에 맞지 않는 사건은 버린다", () => {
    const bad = [
      { ...P1, line: "99" }, // 없는 줄
      { ...P1, id: "P7", payer: "김가람" }, // 명단 밖 사람 (실명)
      { ...P1, id: "P8", amount: 0 }, // 0원
      { ...P1, id: "P9", split: [] }, // 분담자 없음
      { ...base, type: "correct", line: "03", target: ["P5"], amount: 1000 }, // 없는 결제
      { ...base, type: "correct", line: "03", target: ["P1"] }, // 바뀐 값 없음
      { ...base, type: "exclude", line: "02", target: ["P1"], who: "누구" }, // 명단 밖
      { ...base, type: "exclude", line: "02", target: ["P1"], who: "라온", what: "" }, // 빠질 부분 없음
      { ...base, type: "unknown", line: "01" },
      "not an object",
    ];
    const { events, dropped } = toEvents({ events: [P1, ...bad] }, masked, roster);
    expect(events).toHaveLength(1);
    expect(dropped).toBe(bad.length);
  });

  it("full이 확실하지 않은 환불은 부분 환불로 본다", () => {
    const refund = { ...base, type: "refund", line: "06", target: ["P1"], amount: 2000 };
    const { events } = toEvents({ events: [P1, refund] }, masked, roster);
    expect(events[1]).toEqual({ type: "refund", line: "06", target: "P1", status: "done", full: false, amount: 2000 });
  });

  describe("제외·환불·취소 대상과 제외 금액을 코드로 고정", () => {
    const line = (no: string, text: string) => ({ no, speaker: "가람" as const, text });
    const lines = [
      line("01", "점심 60,000원 내가 냈어"),
      line("02", "카페 9,000원 내가 냈어"),
      line("03", "점심 디저트는 난 안 먹었어. 디저트가 12,000원"),
      line("04", "그거 돌려받았어"),
      line("05", "점심 디저트는 난 빼줘"),
      line("06", "점심 60,000원 중에 디저트는 난 안 먹었어"),
    ];
    const p = (no: string, amounts: number[]) => ({ no, speaker: "가람", amounts });
    const parsedLines = [p("01", [60000]), p("02", [9000]), p("03", [12000]), p("04", []), p("05", []), p("06", [60000])];
    const D1 = { ...P1, amount: 60000, item: "점심" };
    const D2 = { ...P1, line: "02", id: "P2", amount: 9000, item: "카페" };
    const ex = (lineNo: string, amount: number | null) => ({ ...base, type: "exclude", line: lineNo, target: ["P1"], who: "라온", what: "디저트", amount });
    const excludeOf = (r: unknown) => toEvents({ events: [D1, D2, r] }, lines, roster, parsedLines).events[2];

    it("AI가 제외 금액을 비워도 그 줄에 결제액보다 작은 금액이 하나면 채운다", () => {
      expect(excludeOf(ex("03", null))).toMatchObject({ type: "exclude", target: "P1", amount: 12000 });
    });

    it("그 줄 금액이 결제 전체 금액이면 채우지 않는다 (질문으로)", () => {
      expect(excludeOf(ex("06", null))).toMatchObject({ amount: null });
    });

    it("대화 어디에도 없는 제외 금액은 추측으로 보고 비운다", () => {
      expect(excludeOf(ex("05", 7000))).toMatchObject({ amount: null });
      expect(excludeOf(ex("03", 12000))).toMatchObject({ amount: 12000 });
    });

    it("항목 이름 없는 환불을 AI가 하나로 정해도 앞 결제를 모두 후보로 돌린다", () => {
      const refund = { ...base, type: "refund", line: "04", target: ["P2"], full: true };
      expect(excludeOf(refund)).toEqual({ type: "refund", line: "04", target: ["P1", "P2"], status: "done", full: true });
    });

    it("항목 이름이 있으면 대상 하나를 그대로 둔다", () => {
      expect(excludeOf(ex("05", null))).toMatchObject({ target: "P1" });
    });

    it("AI가 붙인 이름이 달라도 결제 줄에 쓴 말이 있으면 그 항목으로 본다", () => {
      const D1named = { ...D1, item: "백반" }; // 01줄에는 "점심"이라고 썼다
      const { events } = toEvents({ events: [D1named, D2, ex("05", null)] }, lines, roster, parsedLines);
      expect(events[2]).toMatchObject({ target: "P1" });
    });

    it("숫자가 없는 줄의 외화 범위 밖은 정산 외로 바꾼다", () => {
      const oos = (l: string) => ({ ...base, type: "out_of_scope", line: l, reason: "foreign_currency" });
      const { events } = toEvents({ events: [oos("04"), oos("02")] }, lines, roster, parsedLines);
      expect(events).toEqual([
        { type: "not_settlement", line: "04" },
        { type: "out_of_scope", line: "02", reason: "foreign_currency" },
      ]);
    });

    it("여러 단어 항목 이름은 한 단어만 있어도 그 항목으로 본다", () => {
      const D1w = { ...D1, item: "점심 백반" };
      const { events } = toEvents({ events: [D1w, D2, ex("05", null)] }, lines, roster, parsedLines);
      expect(events[2]).toMatchObject({ target: "P1" });
    });
  });

  it("범위 밖 사유가 목록에 없으면 other", () => {
    const { events } = toEvents({ events: [{ ...base, type: "out_of_scope", line: "05", reason: "weird" }] }, masked, roster);
    expect(events).toEqual([{ type: "out_of_scope", line: "05", reason: "other" }]);
  });

  it("events 배열이 없으면 실패", () => {
    expect(() => toEvents({}, masked, roster)).toThrow("bad_shape");
  });
});

describe("가짜 모드", () => {
  it("MOCK_AI=1이면 AI를 부르지 않고 기준 예시를 돌려준다", async () => {
    vi.stubEnv("MOCK_AI", "1");
    const fetch = stubFetch({});
    const r = await extractEvents(masked, roster, parsed);
    expect(r.events).toEqual(events);
    expect(fetch).not.toHaveBeenCalled();
  });
});
