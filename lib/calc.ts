/**
 * 계산기 — 담당: A (구현계획서 4-4)
 *
 * 1. 항목마다 몫 = 금액 ÷ 분담자 수 (정수), 나머지 = 금액 mod 분담자 수
 * 2. 나머지는 분담자를 '명단 순서'로 정렬해 앞에서부터 1원씩. 받은 항목을 remainderFrom에 기록
 * 3. paid = 환불 반영 결제액 합, balance = paid − total
 * 4. 송금안은 transfer.ts
 * 5. 검산 5개를 checks에 담는다. 하나라도 false면 발행 차단
 *
 * 규칙: 정수만 쓴다(소수·부동소수점 금지). AI를 부르지 않는다.
 */
import { planTransfers } from "./transfer";
import type { Alias, Check, Item, PersonResult, Settlement } from "./types";

export function calculate(items: Item[], roster: Alias[]): Settlement {
  const order = orderOf(roster, items);
  const people = new Map<Alias, PersonResult>();
  for (const alias of order.list) {
    people.set(alias, { alias, paid: 0, shares: {}, remainderFrom: [], total: 0, balance: 0 });
  }
  // 모든 사람에게 모든 항목 칸을 0으로 만들어 둔다 (기준 예시와 같은 모양)
  for (const p of people.values()) for (const it of items) p.shares[it.id] = 0;

  const perItemOk: boolean[] = [];
  for (const it of items) {
    people.get(it.payer)!.paid += it.amount;

    // 같은 사람이 두 번 들어 있어도 한 번만 센다. 명단 순서로 정렬.
    const split = [...new Set(it.split)].sort((a, b) => order.index(a) - order.index(b));
    if (split.length === 0) {
      perItemOk.push(it.amount === 0);
      continue;
    }
    const base = Math.trunc(it.amount / split.length);
    const remainder = it.amount - base * split.length;
    split.forEach((alias, i) => {
      const p = people.get(alias)!;
      const extra = i < remainder ? 1 : 0;
      p.shares[it.id] = base + extra;
      if (extra) p.remainderFrom.push(it.id);
    });
    perItemOk.push(split.reduce((s, a) => s + people.get(a)!.shares[it.id], 0) === it.amount);
  }

  for (const p of people.values()) {
    p.total = Object.values(p.shares).reduce((s, v) => s + v, 0);
    p.balance = p.paid - p.total;
  }

  const list = [...people.values()];
  const transfers = planTransfers(list, order.list);

  const sum = (ns: number[]) => ns.reduce((s, v) => s + v, 0);
  const after = new Map(list.map((p) => [p.alias, p.balance]));
  for (const t of transfers) {
    after.set(t.from, (after.get(t.from) ?? 0) + t.amount);
    after.set(t.to, (after.get(t.to) ?? 0) - t.amount);
  }
  const allNumbers = [
    ...items.flatMap((it) => [it.amount, it.grossAmount]),
    ...list.flatMap((p) => [p.paid, p.total, p.balance, ...Object.values(p.shares)]),
    ...transfers.map((t) => t.amount),
  ];

  const checks: Check[] = [
    { name: "항목별 부담 합 = 항목 금액", ok: perItemOk.every(Boolean) },
    { name: "전체 부담 합 = 전체 순결제액", ok: sum(list.map((p) => p.total)) === sum(list.map((p) => p.paid)) },
    { name: "잔액 합 = 0", ok: sum(list.map((p) => p.balance)) === 0 },
    { name: "송금 반영 후 모두 0", ok: [...after.values()].every((v) => v === 0) },
    { name: "모든 금액이 정수", ok: allNumbers.every(Number.isSafeInteger) },
  ];

  return { people: list, transfers, checks };
}

/** 명단 순서. 명단에 없는 별칭(실수로 들어온 결제자·분담자)은 맨 뒤에 나온 순서대로 붙인다. */
function orderOf(roster: Alias[], items: Item[]) {
  const list = [...new Set(roster)];
  for (const it of items) {
    for (const a of [it.payer, ...it.split]) if (!list.includes(a)) list.push(a);
  }
  const pos = new Map(list.map((a, i) => [a, i]));
  return { list, index: (a: Alias) => pos.get(a)! };
}
