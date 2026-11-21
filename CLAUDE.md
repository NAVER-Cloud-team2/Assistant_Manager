# 대리총무 — AI 코딩 지침

이 저장소는 4명이 각자 AI 코딩 도구로 동시에 작업한다. 아래 규칙을 반드시 지킨다.
(Cursor·Codex 등 다른 도구를 쓰면 이 파일을 그 도구의 지침 파일로 복사해서 쓴다.)

## 먼저 읽을 것
1. `docs/구현계획서.md` — 무엇을 어떤 순서로 만드는지 (특히 4장 모듈 규칙, 6장 데이터 형식, 11장 역할)
2. `lib/types.ts`, `lib/api.ts` — 모두가 쓰는 데이터 모양
3. `tests/fixtures/garam-4.json` — 모두의 정답 예시

## 담당 폴더 — 내 담당 밖은 수정하지 않는다
| 역할 | 수정해도 되는 곳 |
| --- | --- |
| A 계산·정리 | `lib/calc.ts` `lib/transfer.ts` `lib/resolve.ts` `lib/version.ts` `tests/calc.test.ts` `tests/resolve.test.ts` |
| B AI·파서 | `lib/parse.ts` `lib/extract.ts` `eval/run.ts` `eval/dev/` `tests/parse.test.ts` |
| C 총무 화면 | `app/page.tsx` `app/m/` `components/` `lib/mask.ts` `app/globals.css` `tests/mask.test.ts` |
| D 서버·결과 | `app/api/` `app/r/` `lib/store.ts` `lib/crypto.ts` `lib/token.ts` `lib/log.ts` `lib/env.ts` `infra/` `.github/` `tests/api-flow.test.ts` `tests/log.test.ts` |

사용자가 자기 역할을 말하지 않았으면 먼저 물어본다. 남의 폴더를 고쳐야 할 것 같으면 고치지 말고 "담당자에게 요청할 내용"으로 정리해 준다.

## 합의 없이 바꾸지 않는 파일
`lib/types.ts`, `lib/api.ts`, `tests/fixtures/`, `lib/fixture.ts`, `package.json`의 의존성.
바꿔야 하면 변경안을 제안만 하고, 사람이 팀 채팅에서 합의한 뒤 바꾼다.

## 코드 규칙
- 금액은 **원 단위 정수만**. 소수·부동소수점 계산 금지.
- 계산기·조건 정리기(`calc`, `transfer`, `resolve`, `version`)는 AI를 부르지 않는다.
- 실명·전화·계좌가 담긴 원문은 브라우저 밖으로 보내지 않는다. 가림은 `lib/mask.ts`에서만.
- 결과 페이지·발행 문구에 원 발언을 넣지 않는다.
- `console.log` 대신 `lib/log.ts`의 `log`를 쓴다. 대화 본문·토큰을 로그 필드로 넘기지 않는다.
- 비밀키를 코드·커밋·채팅에 넣지 않는다. `.env.local`만 쓴다.
- 껍데기 함수의 `TODO(A|B|C|D)`를 채울 때 함수 이름·인자·반환 타입은 그대로 둔다.

## 작업 방법
- 로컬은 가짜 모드: `MOCK_AI=1`, `STORE=memory` (`.env.example` 참고).
- 커밋 전에 `npm run typecheck`와 `npm test`를 통과시킨다.
- 구현하면서 해당 테스트의 `it.skip`을 `it`로 바꾼다. 테스트를 지우거나 기대값을 바꿔서 통과시키지 않는다.
- 브랜치 이름은 `a/…`, `b/…`, `c/…`, `d/…`. 작게 자주 PR을 올린다.
