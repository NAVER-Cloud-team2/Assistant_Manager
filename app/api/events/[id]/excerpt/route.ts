/** POST /api/events/{id}/excerpt — 가린 줄 저장 → parse → extract → resolve → calc (담당: D) */
import { NextResponse } from "next/server";
import type { ExcerptRequest, ExcerptResponse } from "@/lib/api";
import { jsonError, requireAdmin } from "../../../_lib/auth";
import { ingestExcerpt } from "../../../_lib/pipeline";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meta = await requireAdmin(req, id);
  if (meta instanceof Response) return meta;
  const body = (await req.json().catch(() => null)) as ExcerptRequest | null;
  // TODO(D): 줄 수·길이 제한, 줄 번호 형식 검사
  if (!body || !Array.isArray(body.lines) || body.lines.length === 0) {
    return jsonError(400, "가린 줄 목록이 필요합니다");
  }
  const draft = await ingestExcerpt(meta, body.lines);
  return NextResponse.json<ExcerptResponse>(draft);
}
