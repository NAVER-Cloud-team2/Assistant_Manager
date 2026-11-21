/**
 * 판 관리 — 담당: A (구현계획서 4-5)
 *
 * - 발행할 때마다 n + 1
 * - 2판부터 문구 첫 줄: [N−1판을 대체하는 N판], 사람별 변동액(diff) 포함
 * - priorShared가 '있음'/'모름'이면 transfers = null (재송금 안내 차단), 변동액만
 * - 문구의 결과 링크 자리는 {{RESULT_URL}} (화면에서 실제 주소로 바꾼다)
 * - 문구와 판에는 원 발언·계좌·연락처를 넣지 않는다
 */
import type { Item, PriorShared, Settlement, Version } from "./types";

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
  // TODO(A): 2판 규칙(diff, 첫 줄, 송금안 차단)을 구현한다. 지금은 1판 모양만 만든다.
  const transfers = settlement.transfers;
  const lines = transfers.map((t) => `${t.from} → ${t.to} ${t.amount.toLocaleString("ko-KR")}원`);
  const message = [
    `[대리총무 정산 · ${n}판] ${eventName}`,
    ...lines,
    `내 몫과 이유 보기: ${RESULT_URL_PLACEHOLDER}`,
  ].join("\n");
  return {
    n,
    publishedAt: now,
    priorShared,
    items: items.map(({ id, name, payer, amount, split }) => ({ id, name, payer, amount, split })),
    settlement,
    transfers,
    message,
  };
}
