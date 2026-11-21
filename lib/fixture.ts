/**
 * 기준 예시(tests/fixtures/garam-4.json)를 타입이 붙은 값으로 꺼내 쓰는 곳.
 * 빈 껍데기 함수들은 구현 전까지 이 값을 돌려준다. → 모두가 첫날부터 진짜 모양의 데이터로 일한다.
 */
import data from "@/tests/fixtures/garam-4.json";
import type { Alias, MaskedLine, ParsedLine, Resolution, Settlement, SettlementEvent } from "./types";

export interface Fixture {
  name: string;
  eventName: string;
  roster: Alias[];
  raw: string;
  speakerMap: Record<string, Alias>;
  masked: MaskedLine[];
  parsed: ParsedLine[];
  events: SettlementEvent[];
  resolution: Resolution;
  settlement: Settlement;
  variants: {
    ambiguousTarget: {
      replaceLine: MaskedLine;
      expectQuestion: { kind: string; line: string; optionValues: string[] };
      expectPublishable: boolean;
    };
    version2: {
      addLine: MaskedLine;
      priorShared: "있음";
      balances: Record<Alias, number>;
      deltas: Record<Alias, number>;
      transfers: null;
      messageFirstLine: string;
    };
  };
}

export const garam4 = data as unknown as Fixture;

/** 깊은 복사 — 껍데기 함수가 fixture 원본을 망가뜨리지 않게 */
export function clone<T>(v: T): T {
  return structuredClone(v);
}
