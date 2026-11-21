/** 관리 토큰 확인 — 담당: D */
import { NextResponse } from "next/server";
import { ADMIN_HEADER, type ApiError } from "@/lib/api";
import { getStore, keys } from "@/lib/store";
import { hashToken, sameHash } from "@/lib/token";
import type { EventMeta } from "@/lib/types";

export function jsonError(status: number, error: string) {
  return NextResponse.json<ApiError>({ error }, { status });
}

/** 헤더의 관리 토큰이 맞으면 행사 정보를, 아니면 오류 응답을 돌려준다 */
export async function requireAdmin(req: Request, eventId: string): Promise<EventMeta | Response> {
  const token = req.headers.get(ADMIN_HEADER);
  if (!token) return jsonError(401, "관리 토큰이 없습니다");
  const meta = await getStore().get<EventMeta>(keys.event(eventId));
  if (!meta) return jsonError(404, "행사를 찾을 수 없습니다");
  if (!sameHash(hashToken(token), meta.adminTokenHash)) return jsonError(403, "관리 토큰이 맞지 않습니다");
  return meta;
}

/** 관리 화면(/m/{token})에서 행사 id 찾기 */
export async function findEventIdByAdminToken(token: string): Promise<string | null> {
  return getStore().get<string>(keys.adminToken(hashToken(token)));
}
