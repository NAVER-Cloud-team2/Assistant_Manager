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

  it("나머지 1원: 10,000원을 3명이 → 3,334 / 3,333 / 3,333 (명단 1번이 1원)", () => {
    const s = calculate([item("X", "가", 10000, ["가", "나", "다"])], ["가", "나", "다"]);
    expect(s.people.map((p) => p.total)).toEqual([3334, 3333, 3333]);
    expect(s.people[0].remainderFrom).toEqual(["X"]);
  });

  it("분담자 순서가 명단 순서와 달라도 나머지는 명단 순서로", () => {
    const s = calculate([item("X", "가", 10001, ["다", "나"])], ["가", "나", "다"]);
    const byAlias = Object.fromEntries(s.people.map((p) => [p.alias, p.total]));
    expect(byAlias).toEqual({ 가: 0, 나: 5001, 다: 5000 });
  });

  it("0원 항목(전액 환불)은 아무 부담도 만들지 않는다", () => {
    const s = calculate([item("T", "가", 0, ["가", "나"])], ["가", "나"]);
    expect(s.people.every((p) => p.total === 0 && p.balance === 0)).toBe(true);
  });

  it("나머지 0원: 9,000원을 3명이 → 모두 3,000, 1원 받은 사람 없음", () => {
    const s = calculate([item("X", "가", 9000, ["가", "나", "다"])], ["가", "나", "다"]);
    expect(s.people.map((p) => p.total)).toEqual([3000, 3000, 3000]);
    expect(s.people.every((p) => p.remainderFrom.length === 0)).toBe(true);
  });

  it("나머지 2원: 10,001원을 3명이 → 명단 1·2번이 1원씩", () => {
    const s = calculate([item("X", "다", 10001, ["가", "나", "다"])], ["가", "나", "다"]);
    expect(s.people.map((p) => p.total)).toEqual([3334, 3334, 3333]);
    expect(s.people.map((p) => p.remainderFrom)).toEqual([["X"], ["X"], []]);
  });

  it("분담자 1명: 본인이 전액 부담, 잔액 0", () => {
    const s = calculate([item("X", "나", 7777, ["나"])], ["가", "나"]);
    expect(s.people.map((p) => [p.total, p.balance])).toEqual([[0, 0], [7777, 0]]);
    expect(s.transfers).toEqual([]);
  });

  it("기준 예시: 송금안까지 함께 돌려준다", () => {
    const s = calculate(garam4.resolution.items, garam4.roster);
    expect(s.transfers).toEqual(garam4.settlement.transfers);
    expect(s.checks.map((c) => c.name)).toEqual(garam4.settlement.checks.map((c) => c.name));
  });

  it("분담자가 비어 있는 항목은 검산 실패로 발행을 막는다", () => {
    const s = calculate([item("X", "가", 5000, [])], ["가", "나"]);
    expect(s.checks.every((c) => c.ok)).toBe(false);
  });
});

describe("planTransfers", () => {
  it("기준 예시 송금안", () => {
    expect(planTransfers(garam4.settlement.people, garam4.roster)).toEqual(garam4.settlement.transfers);
  });
});
