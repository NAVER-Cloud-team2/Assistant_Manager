/**
 * 총무 확인값 읽기 — 담당: C
 * 지금 API(/draft)는 저장된 답·직접 입력·줄 분류를 돌려주지 않는데, /answers는 전체를 덮어쓴다.
 * 검토 화면이 기존 값을 잃지 않도록 서버에서 저장된 확인값을 같이 읽는다. (D의 store·crypto를 읽기만 한다)
 * TODO(C): /draft가 확인값을 돌려주도록 합의되면 이 파일을 지우고 API 응답을 쓴다.
 */
import type { StoredConfirm } from "@/app/api/_lib/pipeline";
import { open, type Sealed } from "@/lib/crypto";
import { getStore, keys } from "@/lib/store";

export const EMPTY_CONFIRM: StoredConfirm = { answers: [], manualItems: [], lineOverrides: {} };

export async function loadConfirm(eventId: string): Promise<StoredConfirm> {
  const sealed = await getStore().get<Sealed>(keys.confirm(eventId));
  if (!sealed) return EMPTY_CONFIRM;
  const c = open<Partial<StoredConfirm>>(sealed);
  return {
    answers: c.answers ?? [],
    manualItems: c.manualItems ?? [],
    lineOverrides: c.lineOverrides ?? {},
  };
}
