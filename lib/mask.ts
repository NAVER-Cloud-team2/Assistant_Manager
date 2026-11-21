/**
 * 보내기 전 가림 — 담당: C (구현계획서 3장 'S2 가림 규칙'). 브라우저에서만 실행한다.
 *
 * - 화자 이름: 원문에서 화자 목록을 뽑아 총무가 별칭에 연결 → 본문에서도 별칭으로 치환
 * - 전화번호: 01[016789]-?\d{3,4}-?\d{4} → [전화번호]
 * - 계좌번호: \d{2,6}-\d{2,6}-\d{2,8} 등 → [계좌번호]
 * - 지원 형식: 카카오톡 모바일 "[이름] [오후 9:12] 내용", PC "2026. 11. 19. 오후 9:12, 이름 : 내용"
 * - 연결 안 된 화자가 있으면 전송 전에 경고
 *
 * 규칙: 실명·전화·계좌가 담긴 원문은 절대 서버로 보내지 않는다. 이 파일에서 fetch 금지.
 */
import { clone, garam4 } from "./fixture";
import type { Alias, MaskedLine } from "./types";

/** 붙여넣은 원문에서 화자 이름 목록 (중복 없이, 처음 나온 순서) */
export function listSpeakers(raw: string): string[] {
  // TODO(C): 두 형식을 읽는다. 지금은 기준 예시 화자를 돌려준다.
  void raw;
  return Object.keys(garam4.speakerMap);
}

/** 원문 → 줄 번호가 붙고 가림이 끝난 줄 */
export function maskExcerpt(raw: string, speakerMap: Record<string, Alias>): MaskedLine[] {
  // TODO(C): 화자 치환 + 본문 이름 치환 + 전화·계좌 가림. 지금은 기준 예시를 돌려준다.
  void raw;
  void speakerMap;
  return clone(garam4.masked);
}
