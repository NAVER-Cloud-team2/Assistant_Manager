/** POST /api/events/{id}/answers — 질문 답·직접 입력·줄 분류 수정 → 다시 정리·계산 (담당: D) */
import { NextResponse } from "next/server";
import type { AnswersRequest, AnswersResponse } from "@/lib/api";
import { jsonError, requireAdmin } from "../../../_lib/auth";
import { loadDraft } from "../../../_lib/pipeline";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meta = await requireAdmin(req, id);
  if (meta instanceof Response) return meta;
  const body = (await req.json().catch(() => null)) as AnswersRequest | null;
  if (!body || !Array.isArray(body.answers) || !Array.isArray(body.manualItems)) {
    return jsonError(400, "answers와 manualItems가 필요합니다");
  }
  const draft = await loadDraft(meta, {
    answers: body.answers,
    manualItems: body.manualItems,
    lineOverrides: body.lineOverrides ?? {},
  });
  if (!draft) return jsonError(404, "붙여넣은 대화가 없거나 보관 기간이 지났습니다");
  return NextResponse.json<AnswersResponse>(draft);
}
