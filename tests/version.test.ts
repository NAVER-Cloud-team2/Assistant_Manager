/** 판 관리 테스트 — 담당: A (구현계획서 4-5, 부록 2판 변형) */
import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc";
import { garam4 } from "@/lib/fixture";
import { resolveEvents } from "@/lib/resolve";
import type { SettlementEvent } from "@/lib/types";
import { buildVersion, RESULT_URL_PLACEHOLDER } from "@/lib/version";

const NOW = "2026-11-21T00:00:00.000Z";

function v1(prior: "없음" | "있음" | "모름" = "없음") {
  const r = resolveEvents(garam4.events, garam4.roster);
  return buildVersion(null, r.items, calculate(r.items, garam4.roster), prior, garam4.eventName, NOW);
}

/** 부록 2판 변형: 07줄 "저녁 사실 46,001원이었어" */
function settlementV2() {
  const line = garam4.variants.version2.addLine.no;
  const events: SettlementEvent[] = [...garam4.events, { type: "correct", line, target: "P1", set: { amount: 46001 } }];
  const r = resolveEvents(events, garam4.roster);
  return { items: r.items, settlement: calculate(r.items, garam4.roster) };
}

describe("buildVersion", () => {
  it("1판·이전 공유 없음: 송금안을 싣고 diff는 없다", () => {
    const v = v1();
    expect(v.n).toBe(1);
    expect(v.diff).toBeUndefined();
    expect(v.transfers).toEqual(garam4.settlement.transfers);
    const lines = v.message.split("\n");
    expect(lines[0]).toBe(`[대리총무 정산 · 1판] ${garam4.eventName}`);
    expect(lines).toContain("다온 → 가람 22,000원");
    expect(lines).toContain("라온 → 가람 3,999원");
    expect(lines).toContain("라온 → 보람 8,001원");
    expect(v.message).toContain(RESULT_URL_PLACEHOLDER);
  });

  it("부록 2판: 이전 공유 '있음' → 송금안 없이 변동액만, 첫 줄은 [1판을 대체하는 2판]", () => {
    const expected = garam4.variants.version2;
    const { items, settlement } = settlementV2();
    const v = buildVersion(v1(), items, settlement, expected.priorShared, garam4.eventName, NOW);

    expect(v.n).toBe(2);
    expect(v.transfers).toBe(expected.transfers);
    expect(Object.fromEntries(v.diff!.map((d) => [d.alias, d.after]))).toEqual(expected.balances);
    expect(Object.fromEntries(v.diff!.map((d) => [d.alias, d.delta]))).toEqual(expected.deltas);
    expect(v.message.split("\n")[0]).toBe(expected.messageFirstLine);
    expect(v.message).toContain("가람 +25,999원 → +24,499원 (-1,500원)");
    expect(v.message).not.toContain(" → 가람 "); // 송금 안내 없음
  });

  it("2판이라도 이전 공유 '없음'이면 변동액과 새 송금안을 함께 싣는다", () => {
    const { items, settlement } = settlementV2();
    const v = buildVersion(v1(), items, settlement, "없음", garam4.eventName, NOW);
    expect(v.diff).toHaveLength(4);
    expect(v.transfers).toEqual(settlement.transfers);
    expect(v.message).toContain("송금");
  });

  it("1판인데 '모름'이면 송금안 대신 사람별 받을·보낼 돈", () => {
    const v = v1("모름");
    expect(v.transfers).toBeNull();
    expect(v.message).toContain("가람 25,999원 받을 돈");
    expect(v.message).toContain("다온 22,000원 보낼 돈");
  });

  it("판 번호는 이전 판 + 1", () => {
    const { items, settlement } = settlementV2();
    const v2 = buildVersion(v1(), items, settlement, "있음", garam4.eventName, NOW);
    const v3 = buildVersion(v2, items, settlement, "있음", garam4.eventName, NOW);
    expect(v3.n).toBe(3);
    expect(v3.message.split("\n")[0]).toBe("[2판을 대체하는 3판]");
    expect(v3.diff!.every((d) => d.delta === 0)).toBe(true);
  });

  it("문구와 판에 원 발언·가린 표시가 들어가지 않는다", () => {
    const v = v1();
    const all = JSON.stringify(v);
    for (const l of garam4.masked) expect(all).not.toContain(l.text);
    expect(all).not.toContain("[전화번호]");
    expect(all).not.toContain("010-");
  });
});
