/**
 * 규칙 파서 — 담당: B (구현계획서 4-1)
 *
 * 확실한 것만 읽는다: 줄 번호, 화자, 금액. 의미 해석은 하지 않는다(그건 extract.ts).
 * 금액 표기: 52,001원 / 52001원 / 4만 8천 원 / 4만8천 / 3.5만 → 원 단위 정수
 */
import { clone, garam4 } from "./fixture";
import type { MaskedLine, ParsedLine } from "./types";

/** 한 줄에서 금액을 모두 찾아 원 단위 정수로 */
export function parseAmounts(text: string): number[] {
  // TODO(B): 표기 20종 이상을 처리한다 (tests/parse.test.ts 참고).
  void text;
  return [];
}

export function parseLines(lines: MaskedLine[]): ParsedLine[] {
  // TODO(B): lines마다 { no, speaker, amounts: parseAmounts(text) }. 지금은 기준 예시를 돌려준다.
  void lines;
  return clone(garam4.parsed);
}
