/**
 * 보내기 전 가림 — 담당: C (구현계획서 3장 'S2 가림 규칙'). 브라우저에서만 실행한다.
 *
 * - 화자 이름: 원문에서 화자 목록을 뽑아 총무가 별칭에 연결 → 본문에서도 별칭으로 치환
 *   (본문에는 "김가람" 대신 "가람이랑"처럼 성을 뺀 이름이 자주 나오므로 둘 다 치환)
 * - 연결 안 된 화자: 발언은 화자 null로 보내고, 본문의 그 이름은 [이름]으로 가린다
 * - 전화번호: 01[016789]-?\d{3,4}-?\d{4} → [전화번호]
 * - 계좌번호: \d{2,6}-\d{2,6}-\d{2,8} 등, 하이픈 없는 10~14자리 숫자 → [계좌번호]
 * - 지원 형식: 카카오톡 모바일 "[이름] [오후 9:12] 내용", PC "2026. 11. 19. 오후 9:12, 이름 : 내용"
 *   (모바일 텍스트 내보내기의 "2026년 11월 19일 오후 9:12, 이름 : 내용"도 읽는다)
 *   형식을 못 읽으면 줄마다 화자 null → 화면에서 총무가 직접 고른다.
 *
 * 규칙: 실명·전화·계좌가 담긴 원문은 절대 서버로 보내지 않는다. 이 파일에서 fetch 금지.
 */
import type { Alias, MaskedLine } from "./types";

/** 원문에서 읽어 낸 발언 하나 (아직 가리기 전) */
export interface RawMessage {
  /** 원문의 화자 이름. 형식을 못 읽었으면 null */
  speaker: string | null;
  text: string;
}

export interface ParseResult {
  messages: RawMessage[];
  /** 지원 형식으로 읽었으면 true. false면 줄마다 화자를 직접 골라야 한다 */
  recognized: boolean;
}

export interface MaskOptions {
  /** 총무가 '사적 발언'으로 체크해 뺄 발언 번호 (parseMessages 결과의 0부터 시작하는 인덱스) */
  exclude?: Iterable<number>;
}

const MOBILE = /^\[([^\]]+)\]\s*\[(?:오전|오후)\s*\d{1,2}:\d{2}\]\s?(.*)$/;
const PC = /^\d{4}\s*(?:\.|년)\s*\d{1,2}\s*(?:\.|월)\s*\d{1,2}\s*(?:\.|일)?\s*(?:오전|오후)\s*\d{1,2}:\d{2},\s*(.+?)\s:\s?(.*)$/;
/** 날짜 구분선·입장/퇴장 같은 시스템 줄 */
const SYSTEM = [
  /^-{3,}.*-{3,}$/,
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*\S*요일$/,
  /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*(?:오전|오후)\s*\d{1,2}:\d{2}(?::|,)?\s*\S.*님이\s*(?:들어왔습니다|나갔습니다|초대했습니다).*$/,
  /님과 카카오톡 대화$/,
  /^저장한 날짜\s*:/,
];

function matchMessage(line: string): RawMessage | null {
  const m = MOBILE.exec(line);
  if (m) return { speaker: m[1].trim(), text: m[2] };
  const p = PC.exec(line);
  if (p) return { speaker: p[1].trim(), text: p[2] };
  return null;
}

/** 원문 → 발언 목록. 형식에 맞지 않는 줄은 앞 발언에 이어 붙인다(여러 줄 메시지). */
export function parseMessages(raw: string): ParseResult {
  const rows = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  const messages: RawMessage[] = [];
  let recognized = false;
  for (const row of rows) {
    if (SYSTEM.some((re) => re.test(row))) continue;
    const msg = matchMessage(row);
    if (msg) {
      recognized = true;
      messages.push(msg);
    } else if (recognized && messages.length > 0) {
      const last = messages[messages.length - 1];
      last.text = last.text ? `${last.text} ${row}` : row;
    } else {
      messages.push({ speaker: null, text: row });
    }
  }

  // 한 줄도 형식에 맞지 않으면 줄마다 화자를 직접 고르게 한다
  if (!recognized) return { messages: rows.map((text) => ({ speaker: null, text })), recognized: false };
  // 형식을 읽기 시작하기 전의 머리말(대화방 이름 등)은 버린다
  return { messages: messages.filter((m) => m.speaker !== null), recognized: true };
}

/** 붙여넣은 원문에서 화자 이름 목록 (중복 없이, 처음 나온 순서) */
export function listSpeakers(raw: string): string[] {
  const seen: string[] = [];
  for (const m of parseMessages(raw).messages) {
    if (m.speaker && !seen.includes(m.speaker)) seen.push(m.speaker);
  }
  return seen;
}

/** 별칭에 연결되지 않은 화자 — 전송 전 경고용 */
export function unmappedSpeakers(raw: string, speakerMap: Record<string, Alias>): string[] {
  return listSpeakers(raw).filter((s) => !speakerMap[s]);
}

/** 실명 → 본문에서 찾을 이름들 (전체 이름, 성을 뺀 이름) */
function nameVariants(name: string): string[] {
  const n = name.trim();
  const out = [n];
  // 한글 3~4자 이름은 성(첫 글자)을 뺀 이름도 본문에 나온다: 김가람 → 가람
  if (/^[가-힣]{3,4}$/.test(n)) out.push(n.slice(1));
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PHONE = /(?<!\d)01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;
const ACCOUNT_HYPHEN = /(?<![\d-])\d{2,6}-\d{2,6}-\d{2,8}(?:-\d{1,6})?(?![\d-])/g;
const ACCOUNT_PLAIN = /(?<![\d,.])\d{10,14}(?![\d,.])/g;
const DATE_LIKE = /^(?:19|20)\d{2}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])$/;

/** 본문의 전화·계좌번호 가림 */
export function maskNumbers(text: string): string {
  return text
    .replace(PHONE, "[전화번호]")
    .replace(ACCOUNT_HYPHEN, (m) => (DATE_LIKE.test(m) ? m : "[계좌번호]"))
    .replace(ACCOUNT_PLAIN, "[계좌번호]");
}

/** 본문의 실명 치환. 연결된 이름은 별칭으로, 연결 안 된 화자 이름은 [이름]으로. */
export function maskNames(text: string, speakerMap: Record<string, Alias>, unmapped: string[] = []): string {
  const pairs: [string, string][] = [];
  for (const [real, alias] of Object.entries(speakerMap)) {
    if (!alias) continue;
    for (const v of nameVariants(real)) pairs.push([v, alias]);
  }
  for (const real of unmapped) for (const v of nameVariants(real)) pairs.push([v, "[이름]"]);
  if (pairs.length === 0) return text;

  // 긴 이름부터 찾아야 "김가람"이 "김" + "가람"으로 쪼개지지 않는다
  pairs.sort((a, b) => b[0].length - a[0].length);
  const table = new Map(pairs);
  const re = new RegExp([...table.keys()].map(escapeRe).join("|"), "g");
  return text.replace(re, (m) => table.get(m) ?? m);
}

/** 읽어 낸 발언 → 가린 줄. 줄 번호는 제외 후 01부터 다시 붙인다. */
export function maskMessages(
  messages: RawMessage[],
  speakerMap: Record<string, Alias>,
  options: MaskOptions = {},
): MaskedLine[] {
  const exclude = new Set(options.exclude ?? []);
  const unmapped = [
    ...new Set(messages.map((m) => m.speaker).filter((s): s is string => !!s && !speakerMap[s])),
  ];
  const kept = messages.filter((_, i) => !exclude.has(i));
  return kept.map((m, i) => ({
    no: String(i + 1).padStart(2, "0"),
    speaker: m.speaker ? (speakerMap[m.speaker] ?? null) : null,
    text: maskNames(maskNumbers(m.text), speakerMap, unmapped),
  }));
}

/** 원문 → 줄 번호가 붙고 가림이 끝난 줄 */
export function maskExcerpt(raw: string, speakerMap: Record<string, Alias>): MaskedLine[] {
  return maskMessages(parseMessages(raw).messages, speakerMap);
}
