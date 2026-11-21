/** GET /api/events/{id}/draft — 현재 초안·질문·정산표 (담당: D) */
import { NextResponse } from "next/server";
import type { DraftResponse } from "@/lib/api";
import { jsonError, requireAdmin } from "../../../_lib/auth";
import { loadDraft } from "../../../_lib/pipeline";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meta = await requireAdmin(req, id);
  if (meta instanceof Response) return meta;
  const draft = await loadDraft(meta);
  if (!draft) return jsonError(404, "붙여넣은 대화가 없거나 보관 기간이 지났습니다");
  return NextResponse.json<DraftResponse>(draft);
}
