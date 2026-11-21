/**
 * 발행된 최신 판 읽기 — 담당: C
 * 발행 화면이 처음 열릴 때 지금 몇 판까지 나갔는지 보여 주려고 서버에서 읽는다. (D의 store를 읽기만 한다)
 */
import { getStore, keys } from "@/lib/store";
import type { Version } from "@/lib/types";

export async function loadLatestVersion(eventId: string): Promise<Version | null> {
  const store = getStore();
  const n = await store.get<number>(keys.latestVersion(eventId));
  if (!n) return null;
  return store.get<Version>(keys.version(eventId, n));
}
