/**
 * 공통 약속 ① — 4명 모두가 쓰는 데이터 모양.
 * ⚠️ 합의 없이 고치지 않는다. 바꾸기 전에 팀 채팅에 먼저 알린다. (구현계획서 6장)
 */

/** 참여자 별칭. 명단 배열의 순서가 곧 '나머지 1원' 배분 순서다. */
export type Alias = string;

/** 두 자리 줄 번호 문자열. 예: "01" */
export type LineNo = string;

/** 브라우저에서 가림을 마친 뒤 서버로 가는 한 줄 (실명·전화·계좌 없음) */
export interface MaskedLine {
  no: LineNo;
  speaker: Alias | null;
  text: string;
}

/** 규칙 파서 결과: 확실한 것만 */
export interface ParsedLine {
  no: LineNo;
  speaker: Alias | null;
  amounts: number[];
}

/** 결제 대상 id. 확실하지 않으면 AI는 후보를 배열로 낸다 → 조건 정리기가 질문을 만든다. */
export type Target = string | string[];

export type OutOfScopeReason =
  | "foreign_currency"
  | "prepaid"
  | "partial_refund"
  | "joint_payment"
  | "other";

/** AI 추출이 내는 '사건'. 모든 사건에 근거 줄(line)이 있어야 한다. */
export type SettlementEvent =
  | { type: "payment"; id: string; line: LineNo; payer: Alias; amount: number; item: string; split: Alias[] }
  | { type: "correct"; line: LineNo; target: Target; set: { amount?: number; split?: Alias[]; item?: string; payer?: Alias } }
  | { type: "exclude"; line: LineNo; who: Alias; target: Target; what: string; amount: number | null }
  | { type: "refund"; line: LineNo; target: Target; status: "done"; full: boolean; amount?: number }
  | { type: "cancel_planned"; line: LineNo; target: Target }
  | { type: "out_of_scope"; line: LineNo; reason: OutOfScopeReason }
  | { type: "not_settlement"; line: LineNo };

export type LineStatus = "candidate" | "needs_check" | "not_settlement";

/** 정산 항목 하나 (결제 1건 + 그에 붙은 정정·환불) */
export interface Item {
  id: string;
  name: string;
  payer: Alias;
  /** 정정까지 반영한 결제액 */
  grossAmount: number;
  /** 환불까지 반영한 순액. 전액 환불이면 0 */
  amount: number;
  split: Alias[];
  /** 이 항목을 만든·바꾼 줄 번호들 */
  evidence: LineNo[];
  /** 총무가 확인한 질문 id 또는 직접 입력 표시 */
  confirmations: string[];
  status: "candidate" | "needs_check" | "manual";
}

export type QuestionKind = "target" | "split" | "refund" | "duplicate";

export interface Question {
  id: string;
  kind: QuestionKind;
  line: LineNo;
  prompt: string;
  options: { value: string; label: string }[];
}

/** 총무의 답 (확인값). AI 사건보다 우선한다. */
export interface Answer {
  questionId: string;
  value: string;
  /** Q-분리처럼 금액이 필요한 답 */
  amount?: number;
}

/** 총무가 직접 넣은 항목 */
export interface ManualItem {
  name: string;
  payer: Alias;
  amount: number;
  split: Alias[];
  /** 근거로 삼은 줄 (없으면 빈 배열, 확인자는 총무) */
  lines: LineNo[];
}

export interface Blocker {
  line: LineNo;
  reason: OutOfScopeReason | "unresolved_question" | "invalid_item";
}

export interface Resolution {
  items: Item[];
  questions: Question[];
  blockers: Blocker[];
  lineStatus: Record<LineNo, LineStatus>;
}

export interface PersonResult {
  alias: Alias;
  /** 환불 반영 결제액 */
  paid: number;
  /** 항목 id → 이 사람의 부담액 */
  shares: Record<string, number>;
  /** 나머지 1원을 받은 항목 id */
  remainderFrom: string[];
  total: number;
  /** paid − total. 양수=받을 돈, 음수=보낼 돈 */
  balance: number;
}

export interface Transfer {
  from: Alias;
  to: Alias;
  amount: number;
}

export interface Check {
  name: string;
  ok: boolean;
}

export interface Settlement {
  people: PersonResult[];
  transfers: Transfer[];
  /** 검산 5개 (구현계획서 4-4). 하나라도 false면 발행 차단 */
  checks: Check[];
}

export type PriorShared = "없음" | "있음" | "모름";

export interface BalanceDiff {
  alias: Alias;
  before: number;
  after: number;
  delta: number;
}

/** 발행된 판. 원 발언은 들어가지 않는다. */
export interface Version {
  n: number;
  publishedAt: string;
  priorShared: PriorShared;
  items: Pick<Item, "id" | "name" | "payer" | "amount" | "split">[];
  settlement: Settlement;
  /** 2판부터: 이전 판 대비 사람별 변동 */
  diff?: BalanceDiff[];
  /** 이전 공유 '있음/모름'이면 null (재송금 안내 차단) */
  transfers: Transfer[] | null;
  /** 단톡에 붙여 넣을 문구. 결과 링크 자리는 {{RESULT_URL}} */
  message: string;
}

export interface EventMeta {
  id: string;
  name: string;
  roster: Alias[];
  adminTokenHash: string;
  resultTokenHash: string;
  createdAt: string;
  updatedAt: string;
}

/** 초안 전체 (검토·정산표 화면이 받는 것) */
export interface Draft {
  lines: MaskedLine[];
  resolution: Resolution;
  settlement: Settlement | null;
  /** AI 추출을 썼으면 true → ‘AI 추출 초안’ 표시 */
  aiDraft: boolean;
  /** AI가 실패해 직접 입력으로 넘어갔으면 true */
  aiFailed: boolean;
  publishable: boolean;
}

/** 결과 페이지(모임원용) 데이터 — 별칭·항목·금액·버전만 */
export interface ResultView {
  eventName: string;
  version: number;
  replaces: number | null;
  people: {
    alias: Alias;
    total: number;
    balance: number;
    lines: { item: string; amount: number; reason: string }[];
  }[];
  transfers: Transfer[] | null;
  diff: BalanceDiff[] | null;
  expiresAt: string;
}
