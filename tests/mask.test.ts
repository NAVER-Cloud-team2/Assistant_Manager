/** 보내기 전 가림 테스트 — 담당: C. 구현하면서 it.skip을 it로 바꾼다. */
import { describe, expect, it } from "vitest";
import { garam4 } from "@/lib/fixture";
import { listSpeakers, maskExcerpt, maskMessages, parseMessages, suggestSpeakerMap, unmappedSpeakers } from "@/lib/mask";

describe("maskExcerpt", () => {
  it("기준 예시: 실명·전화번호가 사라지고 줄 번호가 붙는다", () => {
    const lines = maskExcerpt(garam4.raw, garam4.speakerMap);
    expect(lines).toEqual(garam4.masked);
    const all = JSON.stringify(lines);
    for (const realName of Object.keys(garam4.speakerMap)) expect(all).not.toContain(realName);
    expect(all).not.toContain("010-1234-5678");
  });

  it("계좌번호를 가린다", () => {
    const [line] = maskExcerpt("[김가람] [오후 9:12] 신한 110-123-456789로 보내줘", { 김가람: "가람" });
    expect(line.text).toBe("신한 [계좌번호]로 보내줘");
  });

  it("PC 내보내기 형식도 읽는다", () => {
    const lines = maskExcerpt("2026. 11. 19. 오후 9:12, 김가람 : 저녁 52,001원 내가 냈어", { 김가람: "가람" });
    expect(lines[0]).toEqual({ no: "01", speaker: "가람", text: "저녁 52,001원 내가 냈어" });
  });
});

describe("listSpeakers", () => {
  it("기준 예시 화자 4명", () => {
    expect(listSpeakers(garam4.raw)).toEqual(["김가람", "이보람", "박다온", "최라온"]);
  });
});

describe("maskExcerpt — 추가", () => {
  const map = { 김가람: "가람", 이보람: "보람" };

  it("전화번호 표기 여러 가지", () => {
    for (const n of ["010-1234-5678", "01012345678", "010 1234 5678", "010.1234.5678", "011-123-4567"]) {
      const [line] = maskExcerpt(`[김가람] [오후 9:12] 번호 ${n} 이야`, map);
      expect(line.text).toBe("번호 [전화번호] 이야");
    }
  });

  it("하이픈 없는 긴 계좌번호도 가린다", () => {
    const [line] = maskExcerpt("[김가람] [오후 9:12] 카뱅 3333012345678", map);
    expect(line.text).toBe("카뱅 [계좌번호]");
  });

  it("금액·날짜는 가리지 않는다", () => {
    const [line] = maskExcerpt("[김가람] [오후 9:12] 2026-11-19 저녁 1,234,567원 52001원", map);
    expect(line.text).toBe("2026-11-19 저녁 1,234,567원 52001원");
  });

  it("본문의 성 뺀 이름도 별칭으로 바꾼다", () => {
    const [line] = maskExcerpt("[김가람] [오후 9:12] 보람이랑 이보람 둘 다 왔어", { 김가람: "A", 이보람: "B" });
    expect(line.text).toBe("B이랑 B 둘 다 왔어");
  });

  it("연결 안 된 화자는 speaker null, 본문 이름은 [이름]", () => {
    const raw = "[김가람] [오후 9:12] 정우성 왔어?\n[정우성] [오후 9:13] 응";
    const lines = maskExcerpt(raw, map);
    expect(lines).toEqual([
      { no: "01", speaker: "가람", text: "[이름] 왔어?" },
      { no: "02", speaker: null, text: "응" },
    ]);
    expect(JSON.stringify(lines)).not.toContain("우성");
  });

  it("여러 줄 메시지는 앞 발언에 붙이고, 날짜 구분선은 버린다", () => {
    const raw = "--------------- 2026년 11월 19일 목요일 ---------------\n[김가람] [오후 9:12] 저녁\n52,001원 냈어";
    expect(maskExcerpt(raw, map)).toEqual([{ no: "01", speaker: "가람", text: "저녁 52,001원 냈어" }]);
  });

  it("형식을 못 읽으면 줄마다 화자 null", () => {
    const r = parseMessages("저녁 5만원\n2차 3만원");
    expect(r.recognized).toBe(false);
    expect(r.messages).toEqual([
      { speaker: null, text: "저녁 5만원" },
      { speaker: null, text: "2차 3만원" },
    ]);
  });

  it("사적 발언을 빼면 줄 번호를 다시 매긴다", () => {
    const { messages } = parseMessages(garam4.raw);
    const lines = maskMessages(messages, garam4.speakerMap, { exclude: [4] });
    expect(lines.map((l) => l.no)).toEqual(["01", "02", "03", "04", "05"]);
    expect(lines[4].text).toBe("그 택시비 전액 환불 들어왔어");
  });

  it("모바일 텍스트 내보내기 형식", () => {
    const [line] = maskExcerpt("2026년 11월 19일 오후 9:12, 김가람 : 저녁 냈어", map);
    expect(line).toEqual({ no: "01", speaker: "가람", text: "저녁 냈어" });
  });
});

describe("unmappedSpeakers", () => {
  it("연결 안 된 화자 목록", () => {
    expect(unmappedSpeakers(garam4.raw, { 김가람: "가람" })).toEqual(["이보람", "박다온", "최라온"]);
  });
});

describe("suggestSpeakerMap", () => {
  it("기준 예시: 성을 뺀 이름이 별칭이면 연결", () => {
    expect(suggestSpeakerMap(listSpeakers(garam4.raw), garam4.roster)).toEqual(garam4.speakerMap);
  });

  it("같은 이름이 우선, 애매하면 연결하지 않음", () => {
    expect(suggestSpeakerMap(["가람", "김민", "엄마"], ["가람", "민", "김가람"])).toEqual({ 가람: "가람" });
    expect(suggestSpeakerMap(["박하나"], ["하나", "박하나"])).toEqual({ 박하나: "박하나" });
  });
});
