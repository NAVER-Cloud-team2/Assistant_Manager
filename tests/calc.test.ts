/**
 * 계산기·송금안 테스트 — 담당: A
 * 지금 calculate는 껍데기라 기준 예시만 통과한다. 구현하면서 it.skip을 하나씩 it로 바꾼다.
 */
import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc";
import { garam4 } from "@/lib/fixture";
import { planTransfers } from "@/lib/transfer";
import type { Item } from "@/lib/types";

const item = (id: string, payer: string, amount: number, split: string[]): Item => ({
  id,
  name: id,
  payer,
  grossAmount: amount,
  amount,
  split,
  evidence: [],
  confirmations: [],
  status: "candidate",
});

describe("calculate", () => {
  it("기준 예시를 1원까지 맞춘다", () => {
    const s = calculate(garam4.resolution.items, garam4.roster);
    expect(s.people).toEqual(garam4.settlement.people);
    expect(s.checks.every((c) => c.ok)).toBe(true);
  });

  it.skip("나머지 1원: 10,000원을 3명이 → 3,334 / 3,333 / 3,333 (명단 1번이 1원)", () => {
    const s = calculate([item("X", "가", 10000, ["가", "나", "다"])], ["가", "나", "다"]);
    expect(s.people.map((p) => p.total)).toEqual([3334, 3333, 3333]);
    expect(s.people[0].remainderFrom).toEqual(["X"]);
  });

  it.skip("분담자 순서가 명단 순서와 달라도 나머지는 명단 순서로", () => {
    const s = calculate([item("X", "가", 10001, ["다", "나"])], ["가", "나", "다"]);
    const byAlias = Object.fromEntries(s.people.map((p) => [p.alias, p.total]));
    expect(byAlias).toEqual({ 가: 0, 나: 5001, 다: 5000 });
  });

  it.skip("0원 항목(전액 환불)은 아무 부담도 만들지 않는다", () => {
    const s = calculate([item("T", "가", 0, ["가", "나"])], ["가", "나"]);
    expect(s.people.every((p) => p.total === 0 && p.balance === 0)).toBe(true);
  });
});

describe("planTransfers", () => {
  it("기준 예시 송금안", () => {
    expect(planTransfers(garam4.settlement.people, garam4.roster)).toEqual(garam4.settlement.transfers);
  });
});
