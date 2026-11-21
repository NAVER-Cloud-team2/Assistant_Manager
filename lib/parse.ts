/**
 * 규칙 파서 — 담당: B (구현계획서 4-1)
 *
 * 확실한 것만 읽는다: 줄 번호, 화자, 금액. 의미 해석은 하지 않는다(그건 extract.ts).
 * 금액 표기: 52,001원 / 52001원 / 4만 8천 원 / 4만8천 / 3.5만 → 원 단위 정수
 *
 * 금액으로 보는 조건(하나라도): 숫자 뒤에 억·만·천·백 단위, 숫자 뒤에 '원', 쉼표 천 단위(12,000).
 * 단위도 '원'도 없는 숫자("2차", "4명", "52001")는 금액이 아니다. 소수·부동소수점 계산은 쓰지 않는다.
 */
import type { MaskedLine, ParsedLine } from "./types";

const UNIT: Record<string, number> = { 억: 100_000_000, 만: 10_000, 천: 1_000, 백: 100 };

// 숫자는 숫자로 끝난다 ("12,000," 의 끝 쉼표는 문장 부호)
const NUM = String.raw`\d(?:[\d,]*\d)?(?:\.\d+)?`;
// 1) 숫자(+단위) 묶음, 예: "4만 8천 원", "3.5만", "52,001원"   2) 숫자 없는 "만원"·"천원"
const CANDIDATE = new RegExp(
  // 이어 붙이기("4만 8천")는 앞 숫자에 단위가 있을 때만 — "9:12 4만원"이 40012가 되지 않게
  // shortcut: "3 원래"처럼 숫자 뒤 '원'으로 시작하는 낱말은 3원으로 읽는다. 드물고 AI 추출·총무 확인에서 걸러진다
  String.raw`(${NUM}\s*(?:[억만천백]+(?:\s*${NUM}\s*[억만천백]+)*)?\s*원?)|(?<![\d가-힣])([천만])\s*원`,
  "g",
);
const TOKEN = new RegExp(String.raw`(${NUM})\s*([억만천백]*)`, "g");
// 한 숫자 뒤 단위: 천·백 다음에 만·억 ("2천만", "5백만"). "만천", "만만"은 잘못된 표기
const UNITS = /^([천백]?)([만억]?)$/;
const VALID_COMMA = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;
// "10만큼", "3만 명"처럼 단위 글자가 금액이 아닌 말의 일부인 경우
const NOT_AMOUNT_AFTER = /^\s*(?:큼|명|개)/;
// 범위 표기("4, 5만원", "3~4만원", "3만~4만원")는 금액 하나로 정할 수 없으므로 읽지 않는다
const RANGE_BEFORE = /(?:(?<![\d,])\d{1,2}\s*,|\d\s*[억만천백]*원?\s*[~\-])\s*$/;
const RANGE_AFTER = /^\s*[~\-]\s*\d/;

/** "3.5" × 10000 → 35000. 정수 연산만 쓰고, 원 단위로 떨어지지 않으면 null */
function scale(num: string, mult: number): number | null {
  const [whole, frac = ""] = num.replaceAll(",", "").split(".");
  const numer = Number(whole + frac) * mult;
  const denom = 10 ** frac.length;
  if (!Number.isSafeInteger(numer)) return null;
  return numer % denom === 0 ? numer / denom : null;
}

/**
 * 한국어 수 읽기: 만·억이 나오기 전까지 작은 단위를 모았다가 한꺼번에 곱한다.
 * "4만 8천" = 40000 + 8000, "2천 5백만" = (2000 + 500) × 10000
 */
function evaluate(chunk: string): number | null {
  let total = 0;
  let section = 0;
  let any = false;
  for (const [, num, units] of chunk.matchAll(TOKEN)) {
    if (num.includes(",") && !VALID_COMMA.test(num)) return null;
    const u = UNITS.exec(units);
    if (!u) return null;
    const small = u[1] ? UNIT[u[1]] : 1;
    const big = u[2] ? UNIT[u[2]] : 1;
    // 단위 없는 소수("12.000원")는 천 단위 점인지 소수인지 알 수 없다
    if (num.includes(".") && small * big === 1) return null;
    const v = scale(num, small * big);
    if (v === null) return null;
    if (u[2]) {
      total += section * big + v;
      section = 0;
    } else {
      section += v;
    }
    any = true;
  }
  const result = total + section;
  return any && Number.isSafeInteger(result) ? result : null;
}

/** 한 줄에서 금액을 모두 찾아 원 단위 정수로 */
export function parseAmounts(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(CANDIDATE)) {
    if (m[2]) {
      out.push(UNIT[m[2]]);
      continue;
    }
    const chunk = m[1];
    const hasWon = chunk.endsWith("원");
    const hasUnit = /[억만천백]/.test(chunk);
    const hasComma = /\d{1,3}(?:,\d{3})+/.test(chunk);
    if (!hasWon && !hasUnit && !hasComma) continue;
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + chunk.length);
    if (!hasWon && NOT_AMOUNT_AFTER.test(after)) continue;
    if (RANGE_BEFORE.test(before) || RANGE_AFTER.test(after)) continue;
    const v = evaluate(chunk);
    if (v !== null && v > 0) out.push(v);
  }
  return out;
}

export function parseLines(lines: MaskedLine[]): ParsedLine[] {
  return lines.map(({ no, speaker, text }) => ({ no, speaker, amounts: parseAmounts(text) }));
}
