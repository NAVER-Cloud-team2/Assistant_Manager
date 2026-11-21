/** 환경 변수 읽기 (담당: D). 비밀값(키)은 쓰는 곳에서 process.env로 직접 읽고 여기 노출하지 않는다. */
export const env = {
  /** 1이면 OpenAI를 부르지 않고 fixture 사건을 돌려준다 (로컬·CI 기본값) */
  get mockAI(): boolean {
    return process.env.MOCK_AI === "1";
  },
  get store(): "memory" | "redis" {
    return process.env.STORE === "redis" ? "redis" : "memory";
  },
  /**
   * AI 추출에 쓸 OpenAI 모델 이름 (OPENAI_MODEL). 팀장 결정으로 CLOVA Studio 대신 OpenAI를 쓴다.
   * 기본값을 두지 않는다 — 모델은 B가 정하고 서버 .env에 넣는다. 비어 있으면 ""를 돌려주고, 호출하는 쪽(lib/extract.ts)이 오류로 처리한다.
   * API 키(OPENAI_API_KEY)는 여기 두지 않고 lib/extract.ts에서 process.env로 직접 읽는다.
   */
  get openaiModel(): string {
    return process.env.OPENAI_MODEL?.trim() ?? "";
  },
  /** @deprecated CLOVA Studio에서 OpenAI로 바뀌었다. env.openaiModel을 쓴다. B의 extract가 옮겨 가면 지운다. */
  get clovaModel(): string {
    return process.env.CLOVA_MODEL || "HCX-007";
  },
};
