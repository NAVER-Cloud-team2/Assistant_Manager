/**
 * 서버 흐름 연결 테스트 — 담당: D
 * 행사 생성 → 가린 줄 전송 → 초안 → 발행 → 결과 링크 → 모두 지우기 (가짜 모드)
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { POST as createEvent } from "@/app/api/events/route";
import { DELETE as deleteEvent } from "@/app/api/events/[id]/route";
import { POST as postExcerpt } from "@/app/api/events/[id]/excerpt/route";
import { POST as publish } from "@/app/api/events/[id]/publish/route";
import { GET as getResult } from "@/app/api/r/[token]/route";
import ResultPage from "@/app/r/[token]/page";
import { ADMIN_HEADER, type CreateEventResponse, type PublishResponse } from "@/lib/api";
import { garam4 } from "@/lib/fixture";
import { getStore, keys, TTL } from "@/lib/store";
import type { Draft, ResultView, Version } from "@/lib/types";

const CANARY = "CANARY-R6P1 결과 페이지 노출 검사";

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

/** 행사 생성 → (CANARY 줄을 섞은) 발췌 전송 → 선택적으로 1판 발행 */
async function setupEvent(publishFirst: boolean) {
  const created = (await (await createEvent(json({ name: garam4.eventName, roster: garam4.roster }))).json()) as CreateEventResponse;
  const auth = { [ADMIN_HEADER]: created.adminToken };
  const lines = [...garam4.masked, { no: "99", speaker: garam4.roster[0], text: CANARY }];
  expect((await postExcerpt(json({ lines }, auth), params({ id: created.eventId }))).status).toBe(200);
  if (publishFirst) {
    expect((await publish(json({ priorShared: "없음" }, auth), params({ id: created.eventId }))).status).toBe(200);
  }
  return created;
}

const renderPage = async (token: string) => renderToStaticMarkup(await ResultPage(params({ token })));

/** 원 발언·CANARY·토큰이 화면에 없어야 한다 */
function expectNoLeak(html: string, ...secrets: string[]) {
  expect(html).not.toContain("CANARY");
  for (const line of garam4.masked) expect(html).not.toContain(line.text);
  for (const s of secrets) expect(html).not.toContain(s);
}

describe("S6 결과 페이지 (/r/{token})", () => {
  it("1판: 행사 이름·판 번호·만료일·사람별 부담·계산 이유·송금 안내를 보여준다", async () => {
    const created = await setupEvent(true);
    const html = await renderPage(created.resultToken);

    expect(html).toContain(garam4.eventName);
    expect(html).toMatch(/data-testid="version"[^>]*>1판</);
    expect(html).toMatch(/\d{4}년 \d{1,2}월 \d{1,2}일까지 볼 수 있어요/);
    expect(html).not.toContain("대체하는");
    // 사람별 부담 (기준 예시 부록 금액)
    for (const p of garam4.settlement.people) {
      expect(html).toContain(`>${p.alias}<`);
      expect(html).toContain(`${p.total.toLocaleString("ko-KR")}원`);
    }
    // 표기는 단톡 문구(lib/version.ts)와 같게
    expect(html).toContain("25,999원 받을 돈"); // 가람
    expect(html).toContain("22,000원 보낼 돈"); // 다온
    // 이름을 누르면 보이는 계산 이유 (문제정의서 82행)
    expect(html).toContain("<details");
    expect(html).toContain("48,001원을 4명이 나눔, 나머지 1원 포함");
    // 송금 안내
    expect(html).toContain("다온 → 가람");
    expect(html).toContain("22,000원");

    expectNoLeak(html, created.resultToken, created.adminToken, created.eventId);
  });

  it("2판 금액 표시: 기준 예시 version2의 변동액·음수 잔액을 부호와 함께 보여주고 송금 안내는 싣지 않는다", async () => {
    const created = await setupEvent(true);
    const store = getStore();
    const id = created.eventId;
    // 가짜 모드에서는 같은 사건으로 다시 발행하면 변동이 0이라, 변동 금액 표시는 기준 예시 version2 값을 직접 넣어 확인한다
    // (실제 두 번 발행하는 흐름은 아래 테스트)
    const v1 = (await store.get<Version>(keys.version(id, 1)))!;
    const { balances, deltas } = garam4.variants.version2;
    const v2: Version = {
      ...v1,
      n: 2,
      priorShared: "있음",
      transfers: null,
      settlement: { ...v1.settlement, people: v1.settlement.people.map((p) => ({ ...p, balance: balances[p.alias] })) },
      diff: v1.settlement.people.map((p) => ({
        alias: p.alias,
        before: p.balance,
        after: balances[p.alias],
        delta: deltas[p.alias],
      })),
    };
    await store.set(keys.version(id, 2), v2, TTL.result);
    await store.set(keys.latestVersion(id), 2, TTL.result);

    const html = await renderPage(created.resultToken);
    expect(html).toMatch(/data-testid="version"[^>]*>2판</);
    expect(html).toContain("1판을 대체하는 2판");
    expect(html).toContain("1판 대비 변동");
    expect(html).toContain("-1,500원"); // 가람 변동
    expect(html).toContain("+500원"); // 보람·다온·라온 변동
    expect(html).toContain("-22,000원"); // 다온 이전 잔액 (음수 부호 유지)
    expect(html).toContain("-21,500원"); // 다온 지금 잔액
    expect(html).toContain("송금 안내는 싣지 않았어요");
    expect(html).toContain("위의 변동 금액을 보고");
    expect(html).not.toContain("다온 → 가람");
    expectNoLeak(html, created.resultToken, created.adminToken);

    // 같은 링크로 API도 2판을 준다
    const api = (await (await getResult(new Request("http://test.local"), params({ token: created.resultToken }))).json()) as ResultView;
    expect(api.version).toBe(2);
    expect(api.replaces).toBe(1);
  });

  it("실제로 두 번 발행하면(A의 buildVersion) 같은 링크가 '1판을 대체하는 2판'으로 바뀐다", async () => {
    const created = await setupEvent(true);
    const auth = { [ADMIN_HEADER]: created.adminToken };
    const pub2 = await publish(json({ priorShared: "있음" }, auth), params({ id: created.eventId }));
    expect(pub2.status).toBe(200);
    const { version } = (await pub2.json()) as PublishResponse;
    expect(version.n).toBe(2);
    expect(version.message.split("\n")[0]).toBe("[1판을 대체하는 2판]");

    const html = await renderPage(created.resultToken);
    expect(html).toMatch(/data-testid="version"[^>]*>2판</);
    expect(html).toContain("1판을 대체하는 2판");
    expect(html).toContain("1판 대비 변동");
    // 사건이 같으니 4명 모두 변동 없음
    expect(html.match(/변동 없음/g)).toHaveLength(garam4.roster.length);
    expect(html).toContain("+25,999원"); // 가람 이전·지금 잔액
    expect(html).toContain("위의 변동 금액을 보고");
    expect(html).not.toContain("다온 → 가람");
    expectNoLeak(html, created.resultToken, created.adminToken);
  });

  it("1판인데 이전 공유 '있음'이면 송금 안내 없이 사람별 받을·보낼 돈을 보라고 안내한다 (변동 표 없음)", async () => {
    const created = (await (await createEvent(json({ name: garam4.eventName, roster: garam4.roster }))).json()) as CreateEventResponse;
    const auth = { [ADMIN_HEADER]: created.adminToken };
    expect((await postExcerpt(json({ lines: garam4.masked }, auth), params({ id: created.eventId }))).status).toBe(200);
    expect((await publish(json({ priorShared: "있음" }, auth), params({ id: created.eventId }))).status).toBe(200);

    const html = await renderPage(created.resultToken);
    expect(html).toMatch(/data-testid="version"[^>]*>1판</);
    expect(html).not.toContain("대체하는");
    expect(html).not.toContain("대비 변동");
    expect(html).not.toContain("변동 금액");
    expect(html).toContain("송금 안내는 싣지 않았어요");
    expect(html).toContain("위의 사람별 받을 돈·보낼 돈을 보고");
    expect(html).toContain("25,999원 받을 돈");
    expect(html).not.toContain("다온 → 가람");
  });

  it("발행 전이면 안내 문구를 보여준다", async () => {
    const created = await setupEvent(false);
    const html = await renderPage(created.resultToken);
    expect(html).toContain("아직 발행된 정산이 없어요");
    expectNoLeak(html, created.resultToken);
  });

  it("없는 토큰·모두 지우기 이후에는 404 (not-found)", async () => {
    await expect(renderPage("no-such-token")).rejects.toMatchObject({ digest: expect.stringContaining("404") });

    const created = await setupEvent(true);
    const auth = { [ADMIN_HEADER]: created.adminToken };
    await deleteEvent(new Request("http://test.local", { method: "DELETE", headers: auth }), params({ id: created.eventId }));
    await expect(renderPage(created.resultToken)).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });
});
