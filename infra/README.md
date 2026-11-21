# 인프라 (네이버 클라우드) — 담당: D / 인프라 담당

구현계획서 7장 요약. 첫날 오전에 1~3을 끝내면 나머지는 가짜 모드로 바로 작업할 수 있다.

## 첫날 준비 순서

1. **VPC·서브넷·ACG** 만들기 → **Server** 1대(Ubuntu)에 Docker·Nginx 설치
   - ACG: 80·443만 공개, SSH(22)는 팀원 IP만
2. **Cloud DB for Cache** 생성 (같은 VPC, 사설 서브넷) → 서버에서 접속 확인
   - 서버 외부에서는 접근 불가. 그래서 로컬은 `STORE=memory`
3. **CLOVA Studio**에서 HCX-007 API 키 발급, 사용 한도 설정
4. 도메인 연결, `infra/nginx.conf` 적용, `certbot`으로 HTTPS
5. **Container Registry** 생성 → GitHub Secrets·Variables 등록 (루트 README 표) → `deploy.yml` 켜기
6. **Sub Account**로 팀원 권한 분리 (B: CLOVA Studio, D: 서버·DB, 콘솔 전체는 1명)

## 서버 파일

```
/srv/assistant-manager/
  deploy.sh     ← infra/deploy.sh 복사 후 chmod +x
  .env          ← 아래 환경 변수 (chmod 600)
```

## 환경 변수 (서버 .env)

| 이름 | 값 |
| --- | --- |
| `MOCK_AI` | `0` |
| `STORE` | `redis` (RedisStore 구현 전에는 `memory`. **`memory`여도 `ENCRYPTION_KEY`는 필수**) |
| `CLOVASTUDIO_API_KEY` | CLOVA Studio 키 |
| `CLOVA_MODEL` | `HCX-007` |
| `REDIS_URL` | Cloud DB for Cache 사설 주소 |
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

### 하지 말 것

- 키를 `docker-compose.yml`, `Dockerfile`, `.env.example`, 커밋, 채팅, 이슈에 적기
- `infra/.env`에 키 두기 — compose가 자동으로 읽지만 `.dockerignore`는 루트 `.env`만 빼므로 빌드 컨텍스트(`COPY . .`)에 들어갈 수 있다
- 로그·화면에 키 출력하기 (`echo $ENCRYPTION_KEY`, `cat .env`, `docker inspect`를 공유하기)

## 주의

- `STORE=redis`로 바꾸기 전에 `lib/store.ts`의 RedisStore를 구현한다. 구현 전에는 일부러 오류가 난다. (AES-GCM은 `lib/crypto.ts`에 구현됨)
- Nginx 접근 로그는 끈다(주소에 토큰이 있음). 앱 로그는 `lib/log.ts`만 사용.
- 키는 채팅·커밋에 올리지 않는다.
