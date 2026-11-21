/**
 * 안전한 로거 — 담당: D. 모두 console.log 대신 이것을 쓴다.
 *
 * 대화 본문·토큰이 로그에 남지 않도록 민감한 이름의 필드는 값을 지운다.
 * 유출 시험(구현계획서 9장)에서 식별용 가짜 문구가 로그에 0건이어야 한다.
 */
const SENSITIVE = new Set([
  "text",
  "raw",
  "lines",
  "masked",
  "excerpt",
  "events",
  "message",
  "body",
  "prompt",
  "response",
  "speaker",
  "speakerMap",
  "token",
  "adminToken",
  "resultToken",
  "authorization",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return `[array(${value.length})]`;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE.has(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

type Fields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", event: string, fields?: Fields) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...(redact(fields ?? {}) as Fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
