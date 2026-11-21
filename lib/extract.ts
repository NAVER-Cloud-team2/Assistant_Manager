/**
 * AI 추출 — 담당: B (구현계획서 4-2)
 *
 * 가린 줄 + 명단 + 파서 결과 → CLOVA Studio HCX-007 구조화 출력 → 사건 목록(lib/types.ts SettlementEvent)
 * - 요청: v3 chat-completions, responseFormat { type: "json", schema }. 추론(Thinking)은 끈다
 *   (구조화 출력은 HCX-007 전용이고 Thinking·함수 호출과 함께 쓸 수 없다)
 *   문서: https://api.ncloud-docs.com/docs/clovastudio-chatcompletionsv3-so
 * - 스키마는 타입·필수값·enum 위주로 단순하게 (pattern 등 일부 키워드 미지원). 응답은 서버에서 다시 검사
 * - 근거 줄이 없거나 없는 줄을 가리키는 사건은 버린다
 * - 10초 제한은 호출하는 쪽(app/api/_lib/pipeline.ts)이 건다
 * - 요청·응답 본문을 로그에 남기지 않는다 (lib/log.ts만 사용)
 */
import { env } from "./env";
import { NotImplementedError } from "./errors";
import { clone, garam4 } from "./fixture";
import type { Alias, MaskedLine, ParsedLine, SettlementEvent } from "./types";

export interface ExtractResult {
  events: SettlementEvent[];
  model: string;
  promptVersion: string;
  /** 생성형 AI가 만든 초안이면 true → 화면에 ‘AI 추출 초안’ 표시 */
  ai: boolean;
}

export const PROMPT_VERSION = "v0";

/**
 * 사건 JSON 스키마 초안 (B가 다듬는다). CLOVA Studio가 지원하는 키워드만 쓴다.
 * 판정이 애매한 target은 문자열 배열로 받는다.
 */
export const EVENTS_JSON_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["payment", "correct", "exclude", "refund", "cancel_planned", "out_of_scope", "not_settlement"],
          },
          id: { type: "string" },
          line: { type: "string" },
          payer: { type: "string" },
          amount: { type: "integer" },
          item: { type: "string" },
          split: { type: "array", items: { type: "string" } },
          target: { type: "array", items: { type: "string" } },
        },
        required: ["type", "line"],
      },
    },
  },
  required: ["events"],
} as const;

export async function extractEvents(
  lines: MaskedLine[],
  roster: Alias[],
  parsed: ParsedLine[],
): Promise<ExtractResult> {
  if (env.mockAI) {
    return { events: clone(garam4.events), model: "mock", promptVersion: "fixture", ai: true };
  }
  // TODO(B): CLOVA Studio 호출 → 응답 검사 → 근거 없는 사건 제거 → SettlementEvent[] 로 변환
  //   키: process.env.CLOVASTUDIO_API_KEY / 모델: env.clovaModel
  void lines;
  void roster;
  void parsed;
  throw new NotImplementedError("extractEvents — TODO(B): CLOVA Studio HCX-007 호출");
}
