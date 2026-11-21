/**
 * 요청 본문 검증 — 담당: D.
 * 화면(C)의 제한과 같은 기준으로, 화면을 거치지 않고 API를 직접 부르는 요청도 막는다.
 * 오류 메시지에는 입력값을 되돌려 주지 않는다 (실명·원문이 섞였을 수 있음).
 * 통과한 값은 알려진 필드만 골라 새 객체로 만든다 (모르는 필드는 저장하지 않음).
 */
import type { CreateEventRequest, ExcerptRequest } from "@/lib/api";
import type { Alias, MaskedLine } from "@/lib/types";

/** components/CreateEventForm.tsx·PasteFlow.tsx(C)와 같은 값. 줄 길이는 화면 제한이 없어 서버에서만 둔다. */
export const LIMITS = {
  nameMax: 40,
  peopleMin: 2,
  peopleMax: 10,
  aliasMax: 10,
  linesMax: 300,
  lineTextMax: 1000,
} as const;

/** 화면에 보이지 않는 제어 문자 (줄바꿈·탭 포함) */
const CONTROL = /\p{Cc}/u;
/** 두 자리 이상 줄 번호 ("01" ~ "300") — lib/mask.ts가 padStart(2)로 만든다 */
const LINE_NO = /^\d{2,3}$/;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function checkCreateEvent(body: unknown): Checked<CreateEventRequest> {
  if (!isObject(body)) return fail("요청 형식이 올바르지 않습니다");
  const { name, roster } = body;

  if (typeof name !== "string") return fail("행사 이름이 필요합니다");
  const n = name.trim();
  if (n.length === 0) return fail("행사 이름이 필요합니다");
  if (n.length > LIMITS.nameMax) return fail(`행사 이름은 ${LIMITS.nameMax}자까지입니다`);
  if (CONTROL.test(n)) return fail("행사 이름에 쓸 수 없는 문자가 있습니다");

  if (!Array.isArray(roster)) return fail("참여자 명단이 필요합니다");
  if (roster.length < LIMITS.peopleMin) return fail(`참여자는 ${LIMITS.peopleMin}명 이상이어야 합니다`);
  if (roster.length > LIMITS.peopleMax) return fail(`참여자는 ${LIMITS.peopleMax}명까지입니다`);
  const aliases: Alias[] = [];
  for (const a of roster) {
    if (typeof a !== "string") return fail("별칭 형식이 올바르지 않습니다");
    const t = a.trim();
    if (t.length === 0) return fail("빈 별칭이 있습니다");
    if (t.length > LIMITS.aliasMax) return fail(`별칭은 ${LIMITS.aliasMax}자까지입니다`);
    if (CONTROL.test(t)) return fail("별칭에 쓸 수 없는 문자가 있습니다");
    aliases.push(t);
  }
  if (new Set(aliases).size !== aliases.length) return fail("같은 별칭이 있습니다");

  return { ok: true, value: { name: n, roster: aliases } };
}

export function checkExcerpt(body: unknown, roster: Alias[]): Checked<ExcerptRequest> {
  if (!isObject(body) || !Array.isArray(body.lines)) return fail("가린 줄 목록이 필요합니다");
  const { lines } = body;
  if (lines.length === 0) return fail("가린 줄 목록이 필요합니다");
  if (lines.length > LIMITS.linesMax) return fail(`발췌는 ${LIMITS.linesMax}줄까지입니다`);

  const known = new Set(roster);
  const seen = new Set<string>();
  const out: MaskedLine[] = [];
  for (const l of lines) {
    if (!isObject(l)) return fail("줄 형식이 올바르지 않습니다");
    const { no, speaker, text } = l;
    if (typeof no !== "string" || !LINE_NO.test(no) || Number(no) < 1) return fail("줄 번호 형식이 올바르지 않습니다");
    if (seen.has(no)) return fail("줄 번호가 중복되었습니다");
    seen.add(no);
    // 화자는 명단의 별칭이거나 null만 (실명이 화자 칸으로 들어오는 것을 막는다)
    if (speaker !== null && (typeof speaker !== "string" || !known.has(speaker))) {
      return fail("명단에 없는 화자가 있습니다");
    }
    if (typeof text !== "string") return fail("줄 내용 형식이 올바르지 않습니다");
    if (text.length > LIMITS.lineTextMax) return fail(`한 줄은 ${LIMITS.lineTextMax}자까지입니다`);
    out.push({ no, speaker, text });
  }
  return { ok: true, value: { lines: out } };
}
