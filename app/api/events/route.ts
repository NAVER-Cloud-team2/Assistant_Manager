/** POST /api/events — 행사 생성 (담당: D) */
import { NextResponse } from "next/server";
import type { CreateEventRequest, CreateEventResponse } from "@/lib/api";
import { log } from "@/lib/log";
import { getStore, keys, TTL } from "@/lib/store";
import { hashToken, newId, newToken } from "@/lib/token";
import type { EventMeta } from "@/lib/types";
import { jsonError } from "../_lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CreateEventRequest | null;
  // TODO(D): 입력 검증 강화 (명단 2~10명, 별칭 중복 금지, 길이 제한)
  if (!body || typeof body.name !== "string" || !Array.isArray(body.roster) || body.roster.length < 2) {
    return jsonError(400, "행사 이름과 2명 이상의 명단이 필요합니다");
  }
  const id = newId();
  const adminToken = newToken();
  const resultToken = newToken();
  const now = new Date().toISOString();
  const meta: EventMeta = {
    id,
    name: body.name,
    roster: body.roster,
    adminTokenHash: hashToken(adminToken),
    resultTokenHash: hashToken(resultToken),
    createdAt: now,
    updatedAt: now,
  };
  const store = getStore();
  await Promise.all([
    store.set(keys.event(id), meta, TTL.result),
    store.set(keys.adminToken(meta.adminTokenHash), id, TTL.result),
    store.set(keys.resultToken(meta.resultTokenHash), id, TTL.result),
  ]);
  log.info("event_created", { eventId: id, rosterSize: body.roster.length });
  return NextResponse.json<CreateEventResponse>({ eventId: id, adminToken, resultToken });
}
