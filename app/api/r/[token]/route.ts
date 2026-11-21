/** GET /api/r/{resultToken} — 결과 페이지 데이터 (담당: D). 별칭·항목·금액·버전만. */
import { NextResponse } from "next/server";
import type { ResultResponse } from "@/lib/api";
import { jsonError } from "../../_lib/auth";
import { loadResult } from "../../_lib/result";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const r = await loadResult(token);
  if (r.status === "not_found") return jsonError(404, "결과를 찾을 수 없거나 기간이 지났습니다");
  if (r.status === "unpublished") return jsonError(404, "아직 발행된 정산이 없습니다");
  return NextResponse.json<ResultResponse>(r.view, {
    headers: { "Cache-Control": "no-store" },
  });
}
