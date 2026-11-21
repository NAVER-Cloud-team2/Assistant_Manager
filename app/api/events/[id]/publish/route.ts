/** POST /api/events/{id}/publish — 새 판 발행 (담당: D, 판 규칙은 A의 lib/version.ts) */
import { NextResponse } from "next/server";
import type { PublishRequest, PublishResponse } from "@/lib/api";
import { log } from "@/lib/log";
import { getStore, keys, TTL } from "@/lib/store";
import type { Version } from "@/lib/types";
import { buildVersion } from "@/lib/version";
import { jsonError, requireAdmin } from "../../../_lib/auth";
import { loadDraft } from "../../../_lib/pipeline";

const PRIOR = new Set(["없음", "있음", "모름"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meta = await requireAdmin(req, id);
  if (meta instanceof Response) return meta;
  const body = (await req.json().catch(() => null)) as PublishRequest | null;
  if (!body || !PRIOR.has(body.priorShared)) return jsonError(400, "priorShared는 없음·있음·모름 중 하나입니다");

  const draft = await loadDraft(meta);
  if (!draft || !draft.settlement) return jsonError(404, "발행할 정산표가 없습니다");
  if (!draft.publishable) return jsonError(409, "확인이 필요한 질문이나 범위 밖 항목이 남아 있습니다");

  const store = getStore();
  const latest = (await store.get<number>(keys.latestVersion(id))) ?? 0;
  const prev = latest > 0 ? await store.get<Version>(keys.version(id, latest)) : null;
  const version = buildVersion(prev, draft.resolution.items, draft.settlement, body.priorShared, meta.name);

  // 결과 쪽 키는 확정 후 30일
  await Promise.all([
    store.set(keys.version(id, version.n), version, TTL.result),
    store.set(keys.latestVersion(id), version.n, TTL.result),
    store.set(keys.event(id), { ...meta, updatedAt: version.publishedAt }, TTL.result),
    store.set(keys.adminToken(meta.adminTokenHash), id, TTL.result),
    store.set(keys.resultToken(meta.resultTokenHash), id, TTL.result),
  ]);
  log.info("version_published", { eventId: id, n: version.n, priorShared: body.priorShared });
  return NextResponse.json<PublishResponse>({ version });
}
