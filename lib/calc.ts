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
import { clone, garam4 } from "./fixture";
import type { Alias, Item, Settlement } from "./types";

export function calculate(items: Item[], roster: Alias[]): Settlement {
  // TODO(A): 위 1~5를 구현한다. 지금은 기준 예시 결과를 그대로 돌려준다.
  void items;
  void roster;
  return clone(garam4.settlement);
}
