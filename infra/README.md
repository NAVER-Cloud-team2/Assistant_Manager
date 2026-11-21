# 인프라 (네이버 클라우드) — 담당: D / 인프라 담당

구현계획서 7장을 실제 운영 서버에 맞춰 정리한 문서. 로컬 개발은 가짜 모드(`MOCK_AI=1`, `STORE=memory`)라 아래 준비 없이도 된다.

## 운영 서버 (2026-11-21 구성)

| 항목 | 값 |
| --- | --- |
| 서버 | 팀장이 공유한 네이버 클라우드 서버 (Ubuntu 24.04, **vCPU 4**, 메모리 15GB) |
| 주소 | **https://nc776.duckdns.org** (DuckDNS) |
| 웹 서버·HTTPS | **Caddy** (서버에 이미 설치됨, 인증서 자동 발급·갱신). Nginx·certbot은 쓰지 않는다 |
| 앱 | Docker 컨테이너 `assistant-manager`, `127.0.0.1:3000` (외부에 직접 열지 않음) |
| 배포 | 서버에서 직접 빌드: `/srv/assistant-manager/deploy.sh --build` (아래 "배포") |
| AI | OpenAI `gpt-6-luna` (팀장 결정, 모델은 B가 정함) |
| 저장소 | 처음에는 `STORE=memory` → Cloud DB for Cache 연결 후 `redis` (아래 "Redis 연결") |

`infra/nginx.conf`는 Caddy 대신 Nginx를 쓸 때의 참고용으로만 남긴다. `.github/workflows/deploy.yml`(Container Registry 방식)은 꺼 둔다 — GitHub Actions에서 서버로 SSH하려면 SSH 포트를 전 세계에 열어야 하기 때문.

## 처음 한 번: 서버 준비 순서

1. **Docker 설치** (root)
   ```bash
   apt-get update && apt-get install -y docker.io git
   systemctl enable --now docker
   ```
2. **앱 폴더와 `.env`** — 아래 "환경 변수", "암호화 키 넣기", "OpenAI 키 넣기" 참고. `.env`는 `chmod 600`
3. **코드 받기**: `git clone https://github.com/NAVER-Cloud-team2/Assistant_Manager.git /srv/assistant-manager/src`
   (비공개 저장소면 GitHub 아이디와 토큰을 묻는다. 토큰은 서버에 저장하지 않는다)
4. **배포 스크립트 설치**: `install -m 700 /srv/assistant-manager/src/infra/deploy.sh /srv/assistant-manager/deploy.sh`
5. **첫 배포**: `/srv/assistant-manager/deploy.sh --build` → 마지막 줄 `deployed assistant-manager:<커밋>`
6. **Caddy 연결** — 아래 "웹 서버 (Caddy)"
7. **확인** — 아래 "배포 후 확인"

### ACG(방화벽 규칙)

- Inbound: TCP 80·443 전체 허용(Caddy), SSH는 **팀원 IP만**. 학교망은 22번이 막혀 있어 SSH를 2222번으로 받는다
- 3000번(앱)은 ACG에 열지 않는다. `127.0.0.1`에만 묶여 있어 Caddy를 거쳐서만 들어온다

## 서버 사양

- **vCPU 4개 이상, 메모리 8GB 이상, Ubuntu**(팀장 요청).
- 지금은 컨테이너 1개라 Node.js가 실제로 쓰는 코어는 1개 정도다. AI 추출은 OpenAI에서 하므로 서버 부하는 작다. 빌드할 때(`deploy.sh --build`)만 잠깐 여러 코어를 쓴다.
- 4코어를 다 쓰려면 컨테이너를 여러 개 띄우고 Caddy로 나눠야 한다. 그 전에 **`STORE=redis`가 먼저**다(`MemoryStore`는 컨테이너마다 데이터가 따로라 여러 개로 늘리면 행사 데이터가 갈라진다).

## 서버 파일

```
/srv/assistant-manager/
  deploy.sh     ← infra/deploy.sh 복사 (chmod 700)
  .env          ← 아래 환경 변수 (chmod 600). src 밖에 있어서 이미지에 들어가지 않는다
  src/          ← 저장소 clone. deploy.sh --build가 여기서 git pull·빌드
/etc/caddy/Caddyfile  ← 아래 "웹 서버 (Caddy)"
```

## 배포 (서버에서, root)

```bash
/srv/assistant-manager/deploy.sh --build
```

1. `.env` 검사 (키 형식, `STORE=redis`면 `REDIS_URL`). 문제가 있으면 **기존 컨테이너를 건드리지 않고** 멈춘다
2. `src`에서 `git pull --ff-only` → `assistant-manager:<커밋>` 이미지 빌드 (3~5분)
3. 기존 컨테이너 교체 → 5초 뒤 실행 상태·재시작 횟수·`127.0.0.1:3000` 응답 확인
4. **실패하면 이전 이미지로 자동 되돌림** (로그 20줄을 보여 준다)
5. 이미지는 최근 3개만 남긴다

- `main`에 병합된 코드만 배포한다(`src`는 `main` 브랜치).
- 배포하면 컨테이너가 다시 시작된다. **`STORE=memory`인 동안에는 이때 모든 행사가 사라진다.**
- `.env`만 바꿨을 때도 같은 명령으로 다시 띄운다(코드가 같으면 빌드는 캐시로 빨리 끝난다).

## 웹 서버 (Caddy)

`/etc/caddy/Caddyfile`:

```
nc776.duckdns.org {
	reverse_proxy 127.0.0.1:3000
}
```

바꿀 때는 **백업 → 문법 검사 → reload** 순서로 한다.

```bash
cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%Y%m%d-%H%M%S)
# 편집 후
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile   # Valid configuration 확인
systemctl reload caddy
```

- **`log` 지시어를 넣지 않는다.** 관리·결과 링크 주소에 토큰이 들어 있어 접근 로그를 남기지 않는다(Caddy는 `log`가 없으면 접근 로그를 쓰지 않는다).
- 보안 헤더(`noindex`, `no-referrer`, `no-store`)는 앱(`next.config.ts`·결과 페이지)이 붙인다.

## 배포 후 확인

```bash
docker ps --format '{{.Names}}  {{.Image}}  {{.Status}}'
curl -s -o /dev/null -w 'https 홈 → HTTP %{http_code}\n' https://nc776.duckdns.org/
curl -sI https://nc776.duckdns.org/r/test | grep -iE '^(HTTP|x-robots-tag|referrer-policy|cache-control)'   # 404 + 보안 헤더
```

### 유출 시험 (구현계획서 9장)

가짜 대화(예: 실명 김해은·박현수·이미나, 계좌 3333-01-2345678)로 휴대폰에서 행사 생성 → 붙여넣기 → 발행 → 결과 링크 → 모두 지우기까지 한 뒤, 로그에서 0건이어야 한다.

```bash
L=$(docker logs assistant-manager 2>&1)
for w in 김해은 박현수 이미나 3333-01-2345678 "영수증 다시"; do printf '%-18s %s건\n' "$w" "$(grep -cF -- "$w" <<<"$L")"; done
unset L
```

2026-11-21 운영 서버에서 통과: 로그에 실명·계좌·대화 문장 0건, 모두 지우기 후 결과 링크 404.

## Redis 연결 (Cloud DB for Cache)

비공개 Redis는 **같은 VPC 안의 서버에서만** 접속된다. 먼저 콘솔에서 앱 서버의 VPC를 확인한다.

1. Redis를 앱 서버와 **같은 VPC의 Private 서브넷**에 만든다 — DBMS 종류 **SIMPLE**(Cluster 아님, 지금 코드는 단일 연결용), 가장 작은 사양, **백업 사용 안 함**(원문 계열은 백업 제외)
2. Redis의 ACG Inbound에 TCP 6379, 접근 소스 = 앱 서버 ACG(또는 앱 서버 서브넷 대역)
3. 서버 `.env`:
   ```bash
   cd /srv/assistant-manager && umask 077
   read -rsp 'REDIS_URL: ' u && printf 'REDIS_URL=%s\n' "$u" >> .env; unset u; echo   # redis://주소:6379 또는 redis://:비밀번호@주소:6379
   sed -i 's/^STORE=.*/STORE=redis/' .env
   ```
4. `deploy.sh --build`로 다시 띄운 뒤, 행사를 하나 만들고 **컨테이너를 재시작해도 결과 링크가 살아 있는지** 확인한다(`docker restart assistant-manager`)

## 환경 변수 (서버 .env)

| 이름 | 값 |
| --- | --- |
| `MOCK_AI` | `0` |
| `STORE` | `redis` (Redis 연결 전에는 `memory` — 재시작하면 데이터가 사라진다. **`memory`여도 `ENCRYPTION_KEY`는 필수**) |
| `OPENAI_API_KEY` | OpenAI API 키. 아래 "OpenAI 키 넣기" 참고 |
| `OPENAI_MODEL` | `gpt-6-luna` (B가 정함). 기본값 없음 — 비어 있으면 AI 추출이 실패하고 직접 입력으로 넘어간다 |
| `REDIS_URL` | Cloud DB for Cache 사설 주소. 아래 "Redis 연결" 참고 |
| `ENCRYPTION_KEY` | **필수.** 32바이트 키(표준 base64, 44자). 아래 "암호화 키 넣기" 참고. 바꾸면 기존 원문 계열 데이터는 읽을 수 없다 |

## 암호화 키 넣기 (`ENCRYPTION_KEY`)

### 언제 필요한가

| 실행 방법 | `NODE_ENV` | 키 |
| --- | --- | --- |
| `npm run dev`, `npm test` (평소 개발) | development / test | 필요 없음. `STORE=memory`면 평문으로 메모리에만 둔다 |
| `npm run build && npm start` | production | **필수** |
| Docker 이미지 (`deploy.sh`, `docker compose`) | production | **필수** |

`NODE_ENV=production`에서는 **`STORE=memory`여도** 키가 있어야 원문 계열(발췌·사건·확인값)을 저장·조회한다 (`lib/crypto.ts`).

- 키가 비어 있으면: 컨테이너가 시작 검사(`infra/docker-entrypoint.sh`)에서 종료 코드 78로 멈추고, `deploy.sh`는 기존 컨테이너를 내리기 전에 배포를 중단한다.
- 키 형식이 틀리면(따옴표·공백 포함, base64url, 32바이트 아님): `deploy.sh`가 중단한다. 다른 경로로 띄웠다면 첫 요청에서 `CryptoError`(500)가 난다.

### 서버에 넣는 방법 (화면·셸 기록에 값을 남기지 않는다)

```bash
cd /srv/assistant-manager
umask 077                                   # 새 파일을 소유자만 읽게
printf 'ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 32)" >> .env
chmod 600 .env
grep -c '^ENCRYPTION_KEY=' .env             # 1이면 정상 (값은 출력하지 않는다)
```

- **따옴표를 쓰지 않는다.** `docker --env-file`은 `"…"`를 값의 일부로 넣는다.
- 키는 한 번만 만들고 Secret Manager(또는 팀이 정한 비밀 보관소)에 같이 보관한다. 서버 `.env`가 사라지면 기존 원문 계열 데이터를 읽을 수 없다(최대 7일치, 결과 링크는 영향 없음).
- 구현계획서 7장: 해커톤 동안은 서버 환경 변수(`.env`)도 허용, 운영은 Secret Manager 권장.

### 로컬에서 운영 이미지 시험 (선택)

```bash
# 실행할 때마다 임시 키를 만든다. 메모리 저장소라 내리면 데이터도 사라지므로 키가 바뀌어도 된다.
ENCRYPTION_KEY="$(openssl rand -base64 32)" docker compose -f infra/docker-compose.yml up --build
docker compose -f infra/docker-compose.yml down   # 키 없이도 동작

# 이미지 없이 운영 빌드만 시험할 때
npm run build && ENCRYPTION_KEY="$(openssl rand -base64 32)" npm start
```

## OpenAI 키 넣기 (`OPENAI_API_KEY`, `OPENAI_MODEL`)

팀장 결정으로 AI 추출은 CLOVA Studio 대신 **OpenAI**를 쓴다. 키는 서버 `.env`에만 두고, 로컬 개발은 `MOCK_AI=1`이라 키가 필요 없다.

```bash
cd /srv/assistant-manager
umask 077
read -rsp 'OPENAI_API_KEY: ' k && printf 'OPENAI_API_KEY=%s\n' "$k" >> .env; unset k; echo   # 입력이 화면·셸 기록에 남지 않는다
printf 'OPENAI_MODEL=%s\n' '<B가 정한 모델 이름>' >> .env
sed -i 's/^MOCK_AI=.*/MOCK_AI=0/' .env
chmod 600 .env
grep -cE '^OPENAI_API_KEY=.+' .env            # 1이면 정상 (값은 출력하지 않는다)
```

- **따옴표를 쓰지 않는다** (`docker --env-file`).
- OpenAI 대시보드에서 **월 사용 한도**를 걸고, 키는 이 프로젝트 전용으로 만든다. 새면 바로 폐기하고 다시 발급한다.
- 요청·응답 본문은 로그에 남기지 않는다(`lib/log.ts`만 사용). AI에는 브라우저에서 가린 발췌문만 보낸다.
- OpenAI는 국외 사업자라 S2 사전 고지에 "AI 제공사: OpenAI, 국외 이전: 있음"을 알린다(C 담당 화면).
- 키가 없거나 틀려도 서비스는 멈추지 않는다. AI 추출만 실패하고 총무 화면이 직접 입력으로 넘어간다(`app/api/_lib/pipeline.ts`).

## 키 관리 — 하지 말 것

- 키(`ENCRYPTION_KEY`, `OPENAI_API_KEY`)를 `docker-compose.yml`, `Dockerfile`, `.env.example`, 커밋, 채팅, 이슈에 적기
- `infra/.env`에 키 두기 — compose가 자동으로 읽지만 `.dockerignore`는 루트 `.env`만 빼므로 빌드 컨텍스트(`COPY . .`)에 들어갈 수 있다
- 로그·화면에 키 출력하기 (`echo $ENCRYPTION_KEY`, `cat .env`, `docker inspect`를 공유하기)

## 주의

- 웹 서버(Caddy) 접근 로그는 남기지 않는다(주소에 토큰이 있음). 앱 로그는 `lib/log.ts`만 사용.
- `STORE=memory`인 동안에는 배포·재시작 때 데이터가 사라진다. 시연 전에 Redis를 연결한다.
- 키·Redis 주소·서버 비밀번호·인증키(.pem)는 채팅·커밋에 올리지 않는다.
- 해커톤이 끝나면 서버·공인 IP·Redis를 반납한다(정지해도 디스크·IP 요금은 나간다).
