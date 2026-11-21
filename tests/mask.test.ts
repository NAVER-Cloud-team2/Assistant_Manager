/** 보내기 전 가림 테스트 — 담당: C. 구현하면서 it.skip을 it로 바꾼다. */
import { describe, expect, it } from "vitest";
import { garam4 } from "@/lib/fixture";
import { listSpeakers, maskExcerpt } from "@/lib/mask";

describe("maskExcerpt", () => {
  it("기준 예시: 실명·전화번호가 사라지고 줄 번호가 붙는다", () => {
    const lines = maskExcerpt(garam4.raw, garam4.speakerMap);
    expect(lines).toEqual(garam4.masked);
    const all = JSON.stringify(lines);
    for (const realName of Object.keys(garam4.speakerMap)) expect(all).not.toContain(realName);
    expect(all).not.toContain("010-1234-5678");
  });

  it.skip("계좌번호를 가린다", () => {
    const [line] = maskExcerpt("[김가람] [오후 9:12] 신한 110-123-456789로 보내줘", { 김가람: "가람" });
    expect(line.text).toBe("신한 [계좌번호]로 보내줘");
  });

  it.skip("PC 내보내기 형식도 읽는다", () => {
    const lines = maskExcerpt("2026. 11. 19. 오후 9:12, 김가람 : 저녁 52,001원 내가 냈어", { 김가람: "가람" });
    expect(lines[0]).toEqual({ no: "01", speaker: "가람", text: "저녁 52,001원 내가 냈어" });
  });
});

describe("listSpeakers", () => {
  it("기준 예시 화자 4명", () => {
    expect(listSpeakers(garam4.raw)).toEqual(["김가람", "이보람", "박다온", "최라온"]);
  });
});
