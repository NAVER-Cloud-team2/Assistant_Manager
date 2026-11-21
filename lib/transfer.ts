/**
 * 송금안 — 담당: A (구현계획서 4-4의 4번)
 *
 * 보낼 사람(balance < 0)과 받을 사람(balance > 0)을 각각 명단 순서로 두고,
 * 앞에서부터 min(보낼 돈, 받을 돈)씩 짝짓는다.
 * 기준 예시 결과: 다온→가람 22,000 / 라온→가람 3,999 / 라온→보람 8,001
 */
import type { Alias, PersonResult, Transfer } from "./types";

export function planTransfers(people: PersonResult[], roster: Alias[]): Transfer[] {
  const rank = (a: Alias) => {
    const i = roster.indexOf(a);
    return i === -1 ? roster.length : i;
  };
  // sort는 같은 순위끼리 원래 순서를 지킨다 → 명단 밖 사람은 들어온 순서대로 뒤에
  const sorted = [...people].sort((a, b) => rank(a.alias) - rank(b.alias));
  const senders = sorted.filter((p) => p.balance < 0).map((p) => ({ alias: p.alias, left: -p.balance }));
  const receivers = sorted.filter((p) => p.balance > 0).map((p) => ({ alias: p.alias, left: p.balance }));

  const transfers: Transfer[] = [];
  let s = 0;
  let r = 0;
  while (s < senders.length && r < receivers.length) {
    const amount = Math.min(senders[s].left, receivers[r].left);
    transfers.push({ from: senders[s].alias, to: receivers[r].alias, amount });
    senders[s].left -= amount;
    receivers[r].left -= amount;
    if (senders[s].left === 0) s++;
    if (receivers[r].left === 0) r++;
  }
  return transfers;
}
