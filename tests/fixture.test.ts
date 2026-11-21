/**
 * 기준 예시(fixture) 자체가 맞는지 검산한다. 4명 모두의 정답이므로 이 테스트는 항상 통과해야 한다.
 * fixture를 고치면 이 테스트로 먼저 확인한다.
 */
import { describe, expect, it } from "vitest";
import { garam4 } from "@/lib/fixture";

const { roster, resolution, settlement, variants } = garam4;

describe("garam-4 fixture", () => {
  it("항목별 부담 합 = 항목 순액", () => {
    for (const item of resolution.items) {
      const sum = settlement.people.reduce((s, p) => s + (p.shares[item.id] ?? 0), 0);
      expect(sum).toBe(item.amount);
    }
  });

  it("사람별 total·balance가 맞고 잔액 합은 0", () => {
    for (const p of settlement.people) {
      expect(Object.values(p.shares).reduce((a, b) => a + b, 0)).toBe(p.total);
      expect(p.paid - p.total).toBe(p.balance);
    }
    expect(settlement.people.reduce((s, p) => s + p.balance, 0)).toBe(0);
  });

  it("송금안을 반영하면 모두 0원", () => {
    const bal = Object.fromEntries(settlement.people.map((p) => [p.alias, p.balance]));
    for (const t of settlement.transfers) {
      bal[t.from] += t.amount;
      bal[t.to] -= t.amount;
    }
    expect(Object.values(bal).every((v) => v === 0)).toBe(true);
  });

  it("명단 순서와 사람 순서가 같다", () => {
    expect(settlement.people.map((p) => p.alias)).toEqual(roster);
  });

  it("2판 변동액 = 2판 잔액 − 1판 잔액", () => {
    for (const p of settlement.people) {
      expect(variants.version2.balances[p.alias] - p.balance).toBe(variants.version2.deltas[p.alias]);
    }
  });
});
