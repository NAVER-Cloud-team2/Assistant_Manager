/** 규칙 파서 테스트 — 담당: B. 구현하면서 it.skip을 it로 바꾼다. 표기는 20종 이상으로 늘린다. */
import { describe, expect, it } from "vitest";
import { garam4 } from "@/lib/fixture";
import { parseAmounts, parseLines } from "@/lib/parse";

describe("parseLines", () => {
  it("기준 예시", () => {
    expect(parseLines(garam4.masked)).toEqual(garam4.parsed);
  });
});

describe("parseAmounts", () => {
  const cases: [string, number[]][] = [
    ["저녁 52,001원 냈어", [52001]],
    ["52001원", [52001]],
    ["아까 4만 8천 원이야", [48000]],
    ["4만8천", [48000]],
    ["3.5만 원", [35000]],
    ["택시 12,000원, 편의점 3,500원", [12000, 3500]],
    ["다들 조심히 들어가!", []],
  ];
  for (const [text, expected] of cases) {
    it.skip(`"${text}" → ${JSON.stringify(expected)}`, () => {
      expect(parseAmounts(text)).toEqual(expected);
    });
  }
});
