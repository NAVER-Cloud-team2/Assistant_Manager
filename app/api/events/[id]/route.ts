/** DELETE /api/events/{id} — 모두 지우기 (담당: D). 원문·근거·판·결과 링크를 즉시 지운다. */
import { NextResponse } from "next/server";
import type { DeleteResponse } from "@/lib/api";
import { log } from "@/lib/log";
import { getStore, keys } from "@/lib/store";
import { requireAdmin } from "../../_lib/auth";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meta = await requireAdmin(req, id);
  if (meta instanceof Response) return meta;
  const store = getStore();
  const latest = (await store.get<number>(keys.latestVersion(id))) ?? 0;
  const versionKeys = Array.from({ length: latest }, (_, i) => keys.version(id, i + 1));
  await store.del(
    keys.event(id),
    keys.adminToken(meta.adminTokenHash),
    keys.resultToken(meta.resultTokenHash),
    keys.excerpt(id),
    keys.extract(id),
    keys.confirm(id),
    keys.latestVersion(id),
    ...versionKeys,
  );
  log.info("event_deleted", { eventId: id, versions: latest });
  return NextResponse.json<DeleteResponse>({ deleted: true });
}
