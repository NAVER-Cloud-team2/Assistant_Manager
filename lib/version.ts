/**
 * 판 관리 — 담당: A (구현계획서 4-5)
 *
 * - 발행할 때마다 n + 1
 * - 2판부터 문구 첫 줄: [N−1판을 대체하는 N판], 사람별 변동액(diff) 포함
 * - priorShared가 '있음'/'모름'이면 transfers = null (재송금 안내 차단), 변동액만
 * - 문구의 결과 링크 자리는 {{RESULT_URL}} (화면에서 실제 주소로 바꾼다)
 * - 문구와 판에는 원 발언·계좌·연락처를 넣지 않는다
 *
 * 1판인데 '있음'/'모름'이면 비교할 이전 판이 없으므로 송금안 대신 사람별 받을·보낼 돈만 싣는다.
 */
import type { Alias, BalanceDiff, Item, PriorShared, Settlement, Transfer, Version } from "./types";

export const RESULT_URL_PLACEHOLDER = "{{RESULT_URL}}";

export function buildVersion(
  prev: Version | null,
  items: Item[],
  settlement: Settlement,
  priorShared: PriorShared,
  eventName: string,
  now: string = new Date().toISOString(),
): Version {
  const n = prev ? prev.n + 1 : 1;
  const diff = prev ? diffBalances(prev.settlement, settlement) : undefined;
  const transfers: Transfer[] | null = priorShared === "없음" ? settlement.transfers : null;

  const message: string[] = [];
  if (prev) message.push(`[${prev.n}판을 대체하는 ${n}판]`);
  message.push(`[대리총무 정산 · ${n}판] ${eventName}`);

  if (diff) {
    message.push("", "사람별 변동");
    for (const d of diff) {
      message.push(`${d.alias} ${signed(d.before)} → ${signed(d.after)} (${d.delta === 0 ? "변동 없음" : signed(d.delta)})`);
    }
  }

  if (transfers) {
    message.push("", "송금");
    if (transfers.length === 0) message.push("주고받을 돈이 없어요");
    for (const t of transfers) message.push(`${t.from} → ${t.to} ${won(t.amount)}`);
  } else {
    if (!diff) {
      message.push("", "사람별 정산");
      for (const p of settlement.people) message.push(`${p.alias} ${balanceText(p.balance)}`);
    }
    message.push("", "이미 주고받은 돈이 있을 수 있어 송금 안내는 싣지 않았어요. 총무와 확인해 주세요.");
  }

  message.push("", `내 몫과 이유 보기: ${RESULT_URL_PLACEHOLDER}`);

  const version: Version = {
    n,
    publishedAt: now,
    priorShared,
    items: items.map(({ id, name, payer, amount, split }) => ({ id, name, payer, amount, split: [...split] })),
    settlement,
    transfers,
    message: message.join("\n"),
  };
  if (diff) version.diff = diff;
  return version;
}

/** 이번 판 명단 순서대로, 이전 판에만 있던 사람은 뒤에 붙인다. 없던 사람은 0원으로 본다. */
function diffBalances(before: Settlement, after: Settlement): BalanceDiff[] {
  const b = new Map(before.people.map((p) => [p.alias, p.balance]));
  const a = new Map(after.people.map((p) => [p.alias, p.balance]));
  const aliases: Alias[] = [...a.keys()];
  for (const alias of b.keys()) if (!a.has(alias)) aliases.push(alias);
  return aliases.map((alias) => {
    const x = b.get(alias) ?? 0;
    const y = a.get(alias) ?? 0;
    return { alias, before: x, after: y, delta: y - x };
  });
}

function won(n: number): string {
  return `${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;
}

function signed(n: number): string {
  if (n === 0) return "0원";
  return `${n > 0 ? "+" : "-"}${won(n)}`;
}

function balanceText(balance: number): string {
  if (balance > 0) return `${won(balance)} 받을 돈`;
  if (balance < 0) return `${won(balance)} 보낼 돈`;
  return "정산 끝";
}
