/**
 * 총무 화면 공통 — 담당: C
 * 관리 링크(/m/{token})의 토큰으로 행사와 현재 초안을 서버에서 읽는다.
 * (D의 auth·store·pipeline 함수를 읽기만 한다)
 */
import { findEventIdByAdminToken } from "@/app/api/_lib/auth";
import { loadDraft } from "@/app/api/_lib/pipeline";
import { getStore, keys } from "@/lib/store";
import type { Draft, EventMeta } from "@/lib/types";

export interface AdminView {
  meta: EventMeta;
  /** 아직 대화를 붙여넣지 않았거나 7일이 지나 지워졌으면 null */
  draft: Draft | null;
}

/** 토큰이 맞지 않거나 행사가 지워졌으면 null */
export async function loadAdminView(token: string): Promise<AdminView | null> {
  const eventId = await findEventIdByAdminToken(token);
  if (!eventId) return null;
  const meta = await getStore().get<EventMeta>(keys.event(eventId));
  if (!meta) return null;
  return { meta, draft: await loadDraft(meta) };
}
