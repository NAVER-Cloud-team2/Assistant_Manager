/** 안전한 로거 테스트 — 담당: D. 본문·토큰이 로그에 남지 않아야 한다. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "@/lib/log";

afterEach(() => vi.restoreAllMocks());

describe("log", () => {
  it("본문과 토큰 필드를 지운다", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    log.info("test", { eventId: "e1", text: "CANARY-7F3A 저녁 52,001원", adminToken: "secret", nested: { raw: "CANARY-7F3A" } });
    const out = String(spy.mock.calls[0][0]);
    expect(out).toContain("e1");
    expect(out).not.toContain("CANARY-7F3A");
    expect(out).not.toContain("secret");
  });
});
