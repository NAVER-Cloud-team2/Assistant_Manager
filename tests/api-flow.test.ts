/**
 * 서버 흐름 연결 테스트 — 담당: D
 * 행사 생성 → 가린 줄 전송 → 초안 → 발행 → 결과 링크 → 모두 지우기 (가짜 모드)
 */
import { describe, expect, it } from "vitest";
import { POST as createEvent } from "@/app/api/events/route";
import { DELETE as deleteEvent } from "@/app/api/events/[id]/route";
import { POST as postExcerpt } from "@/app/api/events/[id]/excerpt/route";
import { POST as publish } from "@/app/api/events/[id]/publish/route";
import { GET as getResult } from "@/app/api/r/[token]/route";
import { ADMIN_HEADER, type CreateEventResponse, type PublishResponse } from "@/lib/api";
import { garam4 } from "@/lib/fixture";
import type { Draft, ResultView } from "@/lib/types";

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://test.local", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const params = <T>(v: T) => ({ params: Promise.resolve(v) });

describe("API 흐름 (가짜 모드)", () => {
  it("붙여넣기부터 결과 링크까지", async () => {
    const created = (await (await createEvent(json({ name: garam4.eventName, roster: garam4.roster }))).json()) as CreateEventResponse;
    const auth = { [ADMIN_HEADER]: created.adminToken };

    const draftRes = await postExcerpt(json({ lines: garam4.masked }, auth), params({ id: created.eventId }));
    expect(draftRes.status).toBe(200);
    const draft = (await draftRes.json()) as Draft;
    expect(draft.publishable).toBe(true);
    expect(draft.aiDraft).toBe(true);

    const pubRes = await publish(json({ priorShared: "없음" }, auth), params({ id: created.eventId }));
    const { version } = (await pubRes.json()) as PublishResponse;
    expect(version.n).toBe(1);
    expect(version.message).toContain("다온 → 가람 22,000원");

    const result = (await (await getResult(new Request("http://test.local"), params({ token: created.resultToken }))).json()) as ResultView;
    const raon = result.people.find((p) => p.alias === "라온");
    expect(raon?.total).toBe(12000);
    // 결과 페이지에는 원 발언이 없어야 한다
    const body = JSON.stringify(result);
    for (const line of garam4.masked) expect(body).not.toContain(line.text);

    const del = await deleteEvent(new Request("http://test.local", { method: "DELETE", headers: auth }), params({ id: created.eventId }));
    expect(del.status).toBe(200);
    const gone = await getResult(new Request("http://test.local"), params({ token: created.resultToken }));
    expect(gone.status).toBe(404);
  });

  it("관리 토큰이 틀리면 거절", async () => {
    const created = (await (await createEvent(json({ name: "x", roster: ["가", "나"] }))).json()) as CreateEventResponse;
    const res = await postExcerpt(json({ lines: garam4.masked }, { [ADMIN_HEADER]: "wrong" }), params({ id: created.eventId }));
    expect(res.status).toBe(403);
  });
});
