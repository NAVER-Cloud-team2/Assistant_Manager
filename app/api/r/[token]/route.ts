/** GET /api/r/{resultToken} — 결과 페이지 데이터 (담당: D). 별칭·항목·금액·버전만. */
import { NextResponse } from "next/server";
import type { ResultResponse } from "@/lib/api";
import { getStore, keys } from "@/lib/store";
import { hashToken } from "@/lib/token";
import type { EventMeta, Version } from "@/lib/types";
import { jsonError } from "../../_lib/auth";
import { toResultView } from "../../_lib/result";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const store = getStore();
  const id = await store.get<string>(keys.resultToken(hashToken(token)));
  if (!id) return jsonError(404, "결과를 찾을 수 없거나 기간이 지났습니다");
  const [meta, latest] = await Promise.all([
    store.get<EventMeta>(keys.event(id)),
    store.get<number>(keys.latestVersion(id)),
  ]);
  if (!meta || !latest) return jsonError(404, "아직 발행된 정산이 없습니다");
  const version = await store.get<Version>(keys.version(id, latest));
  if (!version) return jsonError(404, "결과를 찾을 수 없거나 기간이 지났습니다");
  return NextResponse.json<ResultResponse>(toResultView(meta, version), {
    headers: { "Cache-Control": "no-store" },
  });
}
