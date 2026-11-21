/** 환경 변수 읽기 (담당: D). 비밀값(키)은 쓰는 곳에서 process.env로 직접 읽고 여기 노출하지 않는다. */
export const env = {
  /** 1이면 CLOVA Studio 대신 fixture 사건 */
  get mockAI(): boolean {
    return process.env.MOCK_AI === "1";
  },
  get store(): "memory" | "redis" {
    return process.env.STORE === "redis" ? "redis" : "memory";
  },
  get clovaModel(): string {
    return process.env.CLOVA_MODEL || "HCX-007";
  },
};
