/**
 * 송금안 — 담당: A (구현계획서 4-4의 4번)
 *
 * 보낼 사람(balance < 0)과 받을 사람(balance > 0)을 각각 명단 순서로 두고,
 * 앞에서부터 min(보낼 돈, 받을 돈)씩 짝짓는다.
 * 기준 예시 결과: 다온→가람 22,000 / 라온→가람 3,999 / 라온→보람 8,001
 */
import { clone, garam4 } from "./fixture";
import type { Alias, PersonResult, Transfer } from "./types";

export function planTransfers(people: PersonResult[], roster: Alias[]): Transfer[] {
  // TODO(A): 위 규칙대로 구현한다. 지금은 기준 예시 결과를 돌려준다.
  void people;
  void roster;
  return clone(garam4.settlement.transfers);
}
