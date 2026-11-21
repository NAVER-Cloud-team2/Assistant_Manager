/** POST /api/events — 행사 생성 (담당: D) */
import { NextResponse } from "next/server";
import type { CreateEventResponse } from "@/lib/api";
import { log } from "@/lib/log";
import { getStore, keys, TTL } from "@/lib/store";
import { hashToken, newId, newToken } from "@/lib/token";
import type { EventMeta } from "@/lib/types";
import { jsonError } from "../_lib/auth";
import { checkCreateEvent } from "../_lib/validate";

export async function POST(req: Request) {
  // 명단 2~10명, 별칭 1~10자·중복 금지, 행사 이름 1~40자 (화면과 같은 기준). 앞뒤 공백은 지운 값을 저장한다.
  const checked = checkCreateEvent(await req.json().catch(() => null));
  if (!checked.ok) return jsonError(400, checked.error);
  const body = checked.value;
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
