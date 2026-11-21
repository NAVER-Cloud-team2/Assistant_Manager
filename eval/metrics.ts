/**
 * 평가 비교 로직 — 담당: B. 입출력 없는 순수 함수만 둔다 (eval/run.ts가 쓴다).
 *
 * 비교 원칙
 * - 결제 id(P1…)는 모델마다 다를 수 있으므로 target은 '대상 결제의 줄 번호'로 바꿔 비교한다
 * - 분담자는 집합으로 비교한다 (문제정의서 6장 '분담자 집합'). 순서는 계산기가 명단으로 정한다
 * - 항목 이름(item)·제외 부분(what)은 표현이 갈리므로 비교하지 않는다
 */
import type { Alias, MaskedLine, Resolution, Settlement, SettlementEvent, Target } from "@/lib/types";

export type Category = "clear" | "correction" | "ambiguous" | "out_of_scope";

/** 케이스 파일 모양: tests/fixtures/garam-4.json과 같다 (masked, roster, events, resolution, settlement) */
export interface EvalCase {
  /** 파일 이름 (실행기가 붙인다) */
  name: string;
  roster: Alias[];
  masked: MaskedLine[];
  /** 정답 사건 */
  events: SettlementEvent[];
  /** 정답 정리 결과 (질문·차단 포함) */
  resolution: Resolution;
  /** 정답 정산 */
  settlement: Settlement;
}

/**
 * 문제정의서 6장의 구분(명확·정정·모호·범위 밖)을 정답에서 읽는다. 케이스 파일에 따로 적지 않는다.
 * 범위 밖: 정답에 차단 사유 / 모호: 정답에 질문 / 정정·취소: 정정·제외·환불·취소 사건 / 나머지: 명확
 */
export function categoryOf(c: Pick<EvalCase, "events" | "resolution">): Category {
  if (c.resolution.blockers.length > 0 || c.events.some((e) => e.type === "out_of_scope")) return "out_of_scope";
  if (c.resolution.questions.length > 0) return "ambiguous";
  if (c.events.some((e) => e.type !== "payment" && e.type !== "not_settlement")) return "correction";
  return "clear";
}

export const ATTRS = ["payer", "amount", "split", "exclude"] as const;
export type Attr = (typeof ATTRS)[number];

export interface Counts {
  tp: number;
  pred: number;
  gold: number;
}

const sorted = (xs: string[]) => [...xs].sort();

/** 결제 id → 그 결제의 줄 번호 */
function paymentLines(events: SettlementEvent[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of events) if (e.type === "payment") m.set(e.id, e.line);
  return m;
}

function targetKey(t: Target, lines: Map<string, string>): string {
  return sorted((Array.isArray(t) ? t : [t]).map((id) => lines.get(id) ?? `?${id}`)).join(",");
}

/** 비교용 문자열. 키 순서를 고정해 JSON 문자열로 만든다 */
export function eventKey(e: SettlementEvent, lines: Map<string, string>): string {
  switch (e.type) {
    case "payment":
      return JSON.stringify([e.type, e.line, e.payer, e.amount, sorted(e.split)]);
    case "correct":
      return JSON.stringify([
        e.type,
        e.line,
        targetKey(e.target, lines),
        e.set.amount ?? null,
        e.set.split ? sorted(e.set.split) : null,
        e.set.payer ?? null,
      ]);
    case "exclude":
      return JSON.stringify([e.type, e.line, targetKey(e.target, lines), e.who, e.amount]);
    case "refund":
      return JSON.stringify([e.type, e.line, targetKey(e.target, lines), e.full, e.amount ?? null]);
    case "cancel_planned":
      return JSON.stringify([e.type, e.line, targetKey(e.target, lines)]);
    case "out_of_scope":
      return JSON.stringify([e.type, e.line, e.reason]);
    case "not_settlement":
      return JSON.stringify([e.type, e.line]);
  }
}

function tuples(events: SettlementEvent[]): Record<Attr, Set<string>> {
  const lines = paymentLines(events);
  const out: Record<Attr, Set<string>> = { payer: new Set(), amount: new Set(), split: new Set(), exclude: new Set() };
  for (const e of events) {
    if (e.type === "payment") {
      out.payer.add(`${e.line}|${e.payer}`);
      out.amount.add(`${e.line}|${e.amount}`);
      out.split.add(`${e.line}|${sorted(e.split).join(",")}`);
    } else if (e.type === "exclude") {
      out.exclude.add(eventKey(e, lines));
    }
  }
  return out;
}

/** 초안 추출: 속성별 일치 수와, 빠진·남는 결제 수 */
export function extractionCounts(pred: SettlementEvent[], gold: SettlementEvent[]) {
  const p = tuples(pred);
  const g = tuples(gold);
  const counts = {} as Record<Attr, Counts>;
  for (const a of ATTRS) {
    counts[a] = { tp: [...p[a]].filter((x) => g[a].has(x)).length, pred: p[a].size, gold: g[a].size };
  }
  const pLines = new Set(paymentLines(pred).values());
  const gLines = new Set(paymentLines(gold).values());
  return {
    counts,
    missing: [...gLines].filter((l) => !pLines.has(l)).length,
    extra: [...pLines].filter((l) => !gLines.has(l)).length,
  };
}

const CHANGE_TYPES = new Set(["correct", "exclude", "refund", "cancel_planned", "out_of_scope"]);

/** 변경·재계산: 정답의 정정·제외·환불·취소·범위 밖 사건이 예측에 모두 같은 값으로 있는가 */
export function changesMatch(pred: SettlementEvent[], gold: SettlementEvent[]): boolean {
  const pLines = paymentLines(pred);
  const gLines = paymentLines(gold);
  const have = new Set(pred.filter((e) => CHANGE_TYPES.has(e.type)).map((e) => eventKey(e, pLines)));
  return gold.filter((e) => CHANGE_TYPES.has(e.type)).every((e) => have.has(eventKey(e, gLines)));
}

/** 재현성: 두 실행의 사건 목록이 (id·순서·표현 차이를 빼고) 같은가 */
export function sameEvents(a: SettlementEvent[], b: SettlementEvent[]): boolean {
  const ka = sorted(a.map((e) => eventKey(e, paymentLines(a))));
  const kb = sorted(b.map((e) => eventKey(e, paymentLines(b))));
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
}

/** 최종 정산: 사람별 순결제액·총부담·잔액이 1원까지 같은가 */
export function sameSettlement(pred: Settlement, gold: Settlement): boolean {
  const key = (s: Settlement) => JSON.stringify(s.people.map((p) => [p.alias, p.paid, p.total, p.balance]));
  return key(pred) === key(gold);
}

/** 정밀도·재현율. 분모가 0이면 null */
export const precision = (c: Counts) => (c.pred === 0 ? null : c.tp / c.pred);
export const recall = (c: Counts) => (c.gold === 0 ? null : c.tp / c.gold);
