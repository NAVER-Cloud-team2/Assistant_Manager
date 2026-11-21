/**
 * 공통 약속 ② — 서버 API 요청·응답 모양 (구현계획서 5장).
 * ⚠️ 합의 없이 고치지 않는다. C(화면)와 D(서버)가 이 모양으로 만난다.
 *
 * 관리 토큰은 요청 헤더 `x-admin-token`으로만 보낸다.
 */
import type { Alias, Answer, Draft, ManualItem, MaskedLine, PriorShared, ResultView, Version } from "./types";

export const ADMIN_HEADER = "x-admin-token";

// POST /api/events
export interface CreateEventRequest {
  name: string;
  roster: Alias[];
}
export interface CreateEventResponse {
  eventId: string;
  adminToken: string;
  resultToken: string;
}

// POST /api/events/{id}/excerpt
export interface ExcerptRequest {
  lines: MaskedLine[];
}
export type ExcerptResponse = Draft;

// GET /api/events/{id}/draft
export type DraftResponse = Draft;

// POST /api/events/{id}/answers
export interface AnswersRequest {
  answers: Answer[];
  manualItems: ManualItem[];
  /** 총무가 '정산 외'로 바꾸거나 되돌린 줄 */
  lineOverrides?: Record<string, "candidate" | "not_settlement">;
}
export type AnswersResponse = Draft;

// POST /api/events/{id}/publish
export interface PublishRequest {
  priorShared: PriorShared;
}
export interface PublishResponse {
  version: Version;
}

// GET /api/r/{resultToken}
export type ResultResponse = ResultView;

// DELETE /api/events/{id}
export interface DeleteResponse {
  deleted: true;
}

export interface ApiError {
  error: string;
}
