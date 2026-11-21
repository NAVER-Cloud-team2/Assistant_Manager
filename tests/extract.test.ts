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
