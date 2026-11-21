/**
 * 평가 실행기 — 담당: B (실행), 미공개 100건 작성·보관: C·D
 * 사용: npm run eval            → eval/dev/*.json (개발용 20~30건)
 *       npm run eval -- hidden  → eval/hidden/*.json (미공개 100건, 저장소에 없음)
 *
 * 케이스 파일 모양은 tests/fixtures/garam-4.json과 같다 (masked, roster, events, resolution, settlement).
 * TODO(B): 지표 계산 — 구현계획서 9장 / 문제정의서 6장 합격선
 *   - 초안 추출: 결제자·금액·분담자 집합·제외 조건별 정밀도·재현율 (≥95%)
 *   - 변경·재계산: 정정·취소 20건 중 19건 이상 마지막 유효 조건
 *   - 필요한 질문: 모호 20건 모두 발행 차단, 명확 40건 중 불필요한 질문 ≤4
 *   - 최종 정산: 지원 80건 1원까지 일치
 *   - 재현성: 같은 입력 3회 실행 시 달라지는 사례 수
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const set = process.argv[2] === "hidden" ? "hidden" : "dev";
const dir = join(process.cwd(), "eval", set);
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];

console.info(`[eval] 세트: ${set} · 케이스 ${files.length}건 (${dir})`);
if (files.length === 0) {
  console.info("[eval] 케이스가 없습니다. 개발용은 eval/dev/에 fixture 모양 JSON으로 추가하세요.");
}
console.info("[eval] TODO(B): 케이스마다 parseLines → extractEvents → resolveEvents → calculate 후 정답과 비교");
