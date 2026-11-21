/**
 * 평가 실행기 — 담당: B (실행), 미공개 100건 작성·보관: C·D
 * 사용: npm run eval                     → 기준 예시 + eval/dev/*.json (개발용 20~30건)
 *       npm run eval -- hidden           → eval/hidden/*.json (미공개 100건, 저장소에 없음). 지표만 출력
 *       npm run eval -- --repeat 3       → 같은 입력을 3번 돌려 달라지는 사례 수(재현성)
 *       npm run eval -- --mock           → AI 대신 fixture (실행기 자체 점검용)
 *
 * 케이스마다 parseLines → extractEvents → resolveEvents → calculate 후 정답과 비교한다.
 * 케이스 파일 모양은 tests/fixtures/garam-4.json과 같다 (masked, roster, events, resolution, settlement).
 * 명확·정정·모호·범위 밖 구분은 정답에서 읽는다 (eval/metrics.ts categoryOf).
 * 합격선: 문제정의서 6장 '정확성의 합격선'
 * shortcut: 케이스에 총무의 답이 없으므로 최종 정산은 질문 없는 케이스(명확·정정)만 비교한다.
 *   모호 케이스의 '확인 뒤' 정산까지 재려면 케이스 형식에 답을 넣는 팀 합의가 필요하다.
 * resolve·calc(A)가 아직 껍데기면 그에 기대는 지표(질문·최종 정산)는 건너뛴다.
 * 실제 AI를 부르므로 .env.local의 키를 쓴다 (MOCK_AI는 이 실행기에서 0으로 덮어쓴다).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { calculate } from "@/lib/calc";
import { extractEvents } from "@/lib/extract";
import { garam4 } from "@/lib/fixture";
import { parseLines } from "@/lib/parse";
import { resolveEvents } from "@/lib/resolve";
import type { SettlementEvent } from "@/lib/types";
import {
  ATTRS,
  categoryOf,
  changesMatch,
  extractionCounts,
  precision,
  recall,
  sameEvents,
  sameSettlement,
  type Attr,
  type Counts,
  type EvalCase,
} from "./metrics";

const args = process.argv.slice(2);
const set = args.includes("hidden") ? "hidden" : "dev";
const repeatAt = args.indexOf("--repeat");
const repeat = repeatAt >= 0 ? Math.max(1, Number(args[repeatAt + 1]) || 1) : 1;
const mock = args.includes("--mock");
const hidden = set === "hidden";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local이 없으면 환경 변수만 쓴다
}
process.env.MOCK_AI = mock ? "1" : "0";
// lib/log.ts의 info 로그(extract_done)가 보고서와 섞이지 않게 끈다. 보고서는 console.log로 쓴다
console.info = () => {};

function loadCases(): EvalCase[] {
  const dir = join(process.cwd(), "eval", set);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  const cases = files.map((f) => ({ name: f, ...JSON.parse(readFileSync(join(dir, f), "utf8")) }) as EvalCase);
  if (!hidden) cases.unshift({ ...garam4, name: "garam-4 (기준 예시)" });
  return cases;
}

// A의 resolve·calc가 껍데기인지: 껍데기는 입력과 상관없이 기준 예시를 돌려준다
const resolveReady = resolveEvents([], ["x"]).items.length === 0;
const calcReady = calculate([], ["x"]).people.every((p) => p.alias === "x");

const cases = loadCases();
const sum = Object.fromEntries(ATTRS.map((a) => [a, { tp: 0, pred: 0, gold: 0 }])) as Record<Attr, Counts>;
const tally = { missing: 0, extra: 0, aiFailed: 0, unstable: 0, ms: [] as number[] };
const bucket = (cat: string) => ({ cat, n: 0, ok: 0 });
const changes = bucket("correction");
const ambiguous = bucket("ambiguous");
const clearQ = { n: 0, unnecessary: 0 };
const outOfScope = bucket("out_of_scope");
const final = { n: 0, ok: 0 };
const fails: string[] = [];

async function extract(c: EvalCase): Promise<SettlementEvent[] | null> {
  const t0 = performance.now();
  try {
    const r = await extractEvents(c.masked, c.roster, parseLines(c.masked));
    tally.ms.push(performance.now() - t0);
    return r.events;
  } catch (e) {
    if (!hidden) fails.push(`${c.name}: AI 실패 (${(e as Error).name})`);
    return null;
  }
}

// tsx가 이 파일을 CommonJS로 바꾸므로 최상위 await 대신 main()으로 감싼다
async function main() {
  console.log(`[eval] 세트: ${set} · 케이스 ${cases.length}건 · 반복 ${repeat}회${mock ? " · 가짜 모드" : ""}`);

  for (const c of cases) {
    const cat = categoryOf(c);
    const got = await extract(c);
    if (!got) tally.aiFailed++;
    const pred = got ?? [];

    for (let i = 1; i < repeat; i++) {
      const again = await extract(c);
      if (again && got && !sameEvents(got, again)) {
        tally.unstable++;
        break;
      }
    }

    if (cat === "clear" || cat === "correction") {
      const r = extractionCounts(pred, c.events);
      for (const a of ATTRS) {
        sum[a].tp += r.counts[a].tp;
        sum[a].pred += r.counts[a].pred;
        sum[a].gold += r.counts[a].gold;
        if (!hidden && r.counts[a].tp !== r.counts[a].gold) fails.push(`${c.name}: ${a} 불일치`);
      }
      tally.missing += r.missing;
      tally.extra += r.extra;
    }
    if (cat === "correction") {
      changes.n++;
      if (changesMatch(pred, c.events)) changes.ok++;
      else if (!hidden) fails.push(`${c.name}: 정정·취소 사건 불일치`);
    }

    if (resolveReady) {
      const r = resolveEvents(pred, c.roster);
      const blocked = r.questions.length > 0 || r.blockers.length > 0;
      if (cat === "ambiguous") {
        ambiguous.n++;
        if (blocked) ambiguous.ok++;
        else if (!hidden) fails.push(`${c.name}: 질문 없이 발행 가능`);
      } else if (cat === "out_of_scope") {
        outOfScope.n++;
        if (r.blockers.length > 0) outOfScope.ok++;
        else if (!hidden) fails.push(`${c.name}: 범위 밖 차단 안 됨`);
      } else if (cat === "clear") {
        clearQ.n++;
        if (r.questions.length > 0) {
          clearQ.unnecessary++;
          if (!hidden) fails.push(`${c.name}: 불필요한 질문 ${r.questions.length}개`);
        }
      }
      if (calcReady && (cat === "clear" || cat === "correction")) {
        final.n++;
        const s = calculate(r.items, c.roster);
        if (sameSettlement(s, c.settlement) && s.checks.every((k) => k.ok)) final.ok++;
        else if (!hidden) fails.push(`${c.name}: 최종 정산 불일치`);
      }
    }
  }

  // ---------- 보고서 ----------
  const pct = (x: number | null) => (x === null ? "  -  " : `${(x * 100).toFixed(1)}%`);
  const mark = (ok: boolean | null) => (ok === null ? "·" : ok ? "✓" : "✗");
  const rate = (b: { n: number; ok: number }, need: number) => (b.n === 0 ? null : b.ok / b.n >= need);

  console.log("\n초안 추출 (명확·정정 케이스의 결제·제외) — 기준: 정밀도·재현율 95% 이상");
  for (const a of ATTRS) {
    const p = precision(sum[a]);
    const r = recall(sum[a]);
    const ok = p === null || r === null ? null : p >= 0.95 && r >= 0.95;
    console.log(`  ${mark(ok)} ${a.padEnd(8)} 정밀도 ${pct(p)}  재현율 ${pct(r)}  (일치 ${sum[a].tp} / 예측 ${sum[a].pred} / 정답 ${sum[a].gold})`);
  }
  console.log(`    빠진 결제 ${tally.missing} · 남는 결제 ${tally.extra}`);

  console.log("\n변경·재계산 — 기준: 정정·취소 케이스 95% 이상 (20건 중 19건)");
  console.log(`  ${mark(rate(changes, 0.95))} 마지막 유효 조건 사건 일치 ${changes.ok}/${changes.n}`);

  console.log("\n필요한 질문 — 기준: 모호 전부 차단, 명확 중 불필요한 질문 10% 이하, 범위 밖 전부 차단");
  if (!resolveReady) {
    console.log("  · 건너뜀: resolveEvents(A)가 아직 껍데기");
  } else {
    console.log(`  ${mark(rate(ambiguous, 1))} 모호 차단 ${ambiguous.ok}/${ambiguous.n}`);
    console.log(`  ${mark(clearQ.n === 0 ? null : clearQ.unnecessary / clearQ.n <= 0.1)} 명확 중 불필요한 질문 ${clearQ.unnecessary}/${clearQ.n}`);
    console.log(`  ${mark(rate(outOfScope, 1))} 범위 밖 차단 ${outOfScope.ok}/${outOfScope.n}`);
  }

  console.log("\n최종 정산 — 기준: 지원 케이스 전부 1원까지 일치");
  if (!resolveReady || !calcReady) console.log("  · 건너뜀: resolveEvents·calculate(A)가 아직 껍데기");
  else console.log(`  ${mark(rate(final, 1))} 정산 일치 ${final.ok}/${final.n}`);

  const avg = tally.ms.length ? Math.round(tally.ms.reduce((a, b) => a + b, 0) / tally.ms.length) : 0;
  const max = tally.ms.length ? Math.round(Math.max(...tally.ms)) : 0;
  console.log(`\n실행: AI 실패 ${tally.aiFailed}건 · 응답 평균 ${avg}ms · 최대 ${max}ms`);
  if (repeat > 1) console.log(`재현성: ${repeat}회 실행 중 결과가 달라진 케이스 ${tally.unstable}/${cases.length}`);

  // 미공개 세트는 B가 내용을 보지 않도록 케이스별 상세를 출력하지 않는다
  if (!hidden && fails.length > 0) {
    console.log("\n케이스별 실패");
    for (const f of fails) console.log(`  - ${f}`);
  }
}

void main();
