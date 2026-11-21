# Assistant_Manager · 대리총무

흩어진 단톡 발언을, 근거가 붙은 정산표로.
총무가 휴대폰 브라우저에서 정산 대화를 붙여넣으면 결제·정정·환불을 이어 정산표를 만들고, 모임원은 가입 없이 결과 링크에서 자기 몫과 이유를 확인한다.

- 기획: [docs/문제정의서.md](docs/문제정의서.md)
- 구현 계획: [docs/구현계획서.md](docs/구현계획서.md)
- AI 코딩 지침: [CLAUDE.md](CLAUDE.md)

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 기본값이 가짜 모드(MOCK_AI=1, STORE=memory)
npm run dev                  # http://localhost:3000
```

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm test` | 단위·흐름 테스트 (가짜 모드) |
| `npm run typecheck` | 타입 검사 |
| `npm run build` | 운영 빌드 (standalone) |
| `npm run eval` | 평가 실행기 (`-- hidden`이면 미공개 세트) |

## 지금 상태: 뼈대

모든 모듈은 **함수 이름·타입만 있는 껍데기**이고, 구현 전까지 기준 예시(`tests/fixtures/garam-4.json`)를 돌려준다.
그래서 화면·서버·계산을 첫날부터 따로 만들 수 있고, 각자 `TODO(A|B|C|D)`를 채우면 자동으로 연결된다.
API 흐름(행사 생성 → 가린 줄 → 초안 → 발행 → 결과 → 삭제)은 가짜 모드에서 이미 끝까지 동작한다(`tests/api-flow.test.ts`).

## 역할과 폴더

| 역할 | 맡는 것 | 파일 |
| --- | --- | --- |
| A 계산·정리 | 계산기, 송금안, 조건 정리기, 판 관리 | `lib/calc.ts` `transfer.ts` `resolve.ts` `version.ts` |
| B AI·파서 | 금액·화자 파서, CLOVA Studio 추출, 평가 실행기 | `lib/parse.ts` `extract.ts` `eval/` |
| C 총무 화면 | S1~S5 화면, 브라우저 가림 | `app/page.tsx` `app/m/` `components/` `lib/mask.ts` |
| D 서버·결과 | API, 저장소·토큰·암호화·로그, S6 결과 페이지, 배포 | `app/api/` `app/r/` `lib/store.ts` `crypto.ts` `token.ts` `log.ts` `infra/` `.github/` |
| 모두 합의 | 데이터 모양과 정답 | `lib/types.ts` `lib/api.ts` `tests/fixtures/` |

```
app/
  page.tsx                 S1 행사 만들기            (C)
  m/[token]/               S2~S5 총무 화면          (C)
  r/[token]/page.tsx       S6 결과 페이지            (D)
  api/                     서버 API 7개              (D)
lib/                       모듈 (파일별 담당은 위 표)
components/                화면 부품                 (C)
tests/                     테스트 + fixtures/garam-4.json
eval/                      평가 실행기 (hidden/은 저장소 제외)
infra/                     Docker·Nginx·배포 스크립트 (D)
docs/                      문제정의서·구현계획서
```

## 작업 규칙

1. 자기 담당 파일만 고친다. `lib/types.ts`·`lib/api.ts`·fixture는 팀 합의 후에만 바꾼다.
2. 브랜치는 `a/…` `b/…` `c/…` `d/…`, PR로만 `main`에 합친다. CI(타입 검사·테스트·빌드)가 통과해야 한다.
3. 구현하면서 테스트의 `it.skip`을 `it`로 바꾼다.
4. 비밀키는 `.env.local`에만. 커밋·채팅 금지.
5. 미공개 평가 100건은 저장소에 넣지 않는다(B가 보지 않도록).

## 배포 (네이버 클라우드)

`main`에 합쳐지면 `.github/workflows/deploy.yml`이 이미지를 만들어 Container Registry에 올리고 스테이징 서버에서 다시 띄운다.
처음에는 꺼져 있다. 인프라 준비가 끝나면 저장소 Variables에 `DEPLOY_ENABLED=true`와 아래 Secrets를 넣는다.

| Secret | 값 |
| --- | --- |
| `NCR_REGISTRY` | Container Registry 주소 (예: `xxxx.kr.ncr.ntruss.com`) |
| `NCP_ACCESS_KEY` / `NCP_SECRET_KEY` | 레지스트리 로그인용 API 인증키 |
| `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` | 스테이징 서버 SSH |

서버 준비 순서와 환경 변수는 [infra/README.md](infra/README.md).

## 라이선스

MIT
