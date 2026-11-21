/** POST /api/events/{id}/excerpt — 가린 줄 저장 → parse → extract → resolve → calc (담당: D) */
import { NextResponse } from "next/server";
import type { ExcerptResponse } from "@/lib/api";
import { jsonError, requireAdmin } from "../../../_lib/auth";
import { ingestExcerpt } from "../../../_lib/pipeline";
import { checkExcerpt } from "../../../_lib/validate";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meta = await requireAdmin(req, id);
  if (meta instanceof Response) return meta;
  // 1~300줄, 줄 번호 "01" 형식·중복 금지, 화자는 명단 별칭 또는 null, 한 줄 1,000자까지. 알려진 필드만 저장한다.
  const checked = checkExcerpt(await req.json().catch(() => null), meta.roster);
  if (!checked.ok) return jsonError(400, checked.error);
  const draft = await ingestExcerpt(meta, checked.value.lines);
  return NextResponse.json<ExcerptResponse>(draft);
}
