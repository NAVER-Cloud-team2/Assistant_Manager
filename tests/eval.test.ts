/** 평가 비교 로직 테스트 — 담당: B */
import { describe, expect, it } from "vitest";
import { categoryOf, changesMatch, extractionCounts, sameEvents, sameSettlement } from "@/eval/metrics";
import { garam4 } from "@/lib/fixture";
import type { SettlementEvent } from "@/lib/types";

const gold = garam4.events;
/** 결제 id를 모두 바꾸고 분담자 순서를 뒤집은 예측 (내용은 같다) */
const renamed: SettlementEvent[] = gold.map((e) => {
  const id = (x: string) => x.replace("P", "X");
  if (e.type === "payment") return { ...e, id: id(e.id), split: [...e.split].reverse() };
  if ("target" in e) return { ...e, target: Array.isArray(e.target) ? e.target.map(id) : id(e.target) };
  return e;
});

describe("extractionCounts", () => {
  it("정답과 같으면 모든 속성이 일치", () => {
    const r = extractionCounts(gold, gold);
    expect(r.counts.payer).toEqual({ tp: 3, pred: 3, gold: 3 });
    expect(r.counts.amount).toEqual({ tp: 3, pred: 3, gold: 3 });
    expect(r.missing).toBe(0);
    expect(r.extra).toBe(0);
  });

  it("id가 다르고 분담자 순서가 달라도 같은 것으로 본다", () => {
    const r = extractionCounts(renamed, gold);
    expect(r.counts.split.tp).toBe(3);
  });

  it("금액이 틀리고 결제가 빠지면 센다", () => {
    const pred = gold
      .filter((e) => !(e.type === "payment" && e.id === "P3"))
      .map((e) => (e.type === "payment" && e.id === "P1" ? { ...e, amount: 52000 } : e));
    const r = extractionCounts(pred, gold);
    expect(r.counts.amount).toEqual({ tp: 1, pred: 2, gold: 3 });
    expect(r.missing).toBe(1);
  });
});

describe("changesMatch", () => {
  it("정정·환불이 같은 결제(줄)를 가리키면 일치", () => {
    expect(changesMatch(renamed, gold)).toBe(true);
  });

  it("정정 대상이 다르면 불일치", () => {
    const pred = gold.map((e) => (e.type === "correct" ? { ...e, target: "P2" } : e));
    expect(changesMatch(pred, gold)).toBe(false);
  });

  it("후보 배열과 단일 대상은 다르다 (Q-대상)", () => {
    const pred = gold.map((e) => (e.type === "correct" ? { ...e, target: ["P1", "P2"] } : e));
    expect(changesMatch(pred, gold)).toBe(false);
  });
});

describe("categoryOf", () => {
  const { resolution } = garam4;
  const payment = gold.filter((e) => e.type === "payment");

  it("정답에서 구분을 읽는다", () => {
    expect(categoryOf(garam4)).toBe("correction");
    expect(categoryOf({ events: payment, resolution })).toBe("clear");
    const q = { id: "q", kind: "target" as const, line: "03", prompt: "", options: [] };
    expect(categoryOf({ events: gold, resolution: { ...resolution, questions: [q] } })).toBe("ambiguous");
    expect(categoryOf({ events: [...gold, { type: "out_of_scope", line: "07", reason: "prepaid" }], resolution })).toBe("out_of_scope");
  });
});

describe("sameEvents · sameSettlement", () => {
  it("순서·id만 다르면 같은 결과", () => {
    expect(sameEvents([...renamed].reverse(), gold)).toBe(true);
  });

  it("정산은 사람별 금액이 1원만 달라도 다르다", () => {
    const s = structuredClone(garam4.settlement);
    expect(sameSettlement(s, garam4.settlement)).toBe(true);
    s.people[0].balance += 1;
    expect(sameSettlement(s, garam4.settlement)).toBe(false);
  });
});
