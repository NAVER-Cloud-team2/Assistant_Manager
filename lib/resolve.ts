/**
 * 조건 정리기 — 담당: A (구현계획서 4-3, 핵심)
 *
 * 사건을 줄 번호 순서로 적용해 항목·질문·차단 사유를 만든다.
 * - 결제: 항목 생성 (결제자 1명, 금액 > 0, 분담자 1명 이상)
 * - 정정: 대상이 하나면 적용하고 근거를 잇는다. 후보가 둘 이상이면 Q-대상 질문
 * - 제외: 분리 금액이 없으면 Q-분리 질문. 분리 후 합 = 원 결제액
 * - 환불: done + full → 순액 0. cancel_planned → Q-환불로 보류. 부분 환불은 범위 밖
 * - 중복 의심 → Q-중복
 * - 범위 밖 → blockers (전체 송금안 발행 차단)
 * - 정산 외 → 항목 없음
 * 총무의 답(answers)과 직접 입력(manualItems)은 AI 사건보다 우선한다. 근거에 confirmations로 남긴다.
 *
 * 규칙: AI를 부르지 않는다. 금액 계산은 calc.ts에 맡긴다.
 */
import { clone, garam4 } from "./fixture";
import type { Alias, Answer, ManualItem, Resolution, Settlement, SettlementEvent } from "./types";

export function resolveEvents(
  events: SettlementEvent[],
  roster: Alias[],
  answers: Answer[] = [],
  manualItems: ManualItem[] = [],
  lineOverrides: Record<string, "candidate" | "not_settlement"> = {},
): Resolution {
  // TODO(A): 위 규칙을 구현한다. 지금은 기준 예시 결과를 돌려준다.
  void events;
  void roster;
  void answers;
  void manualItems;
  void lineOverrides;
  return clone(garam4.resolution);
}

/** 발행 가능 조건: 미해결 질문 0, 차단 0, 검산 모두 통과 */
export function isPublishable(resolution: Resolution, settlement: Settlement | null): boolean {
  return (
    settlement !== null &&
    resolution.items.length > 0 &&
    resolution.questions.length === 0 &&
    resolution.blockers.length === 0 &&
    settlement.checks.every((c) => c.ok)
  );
}
