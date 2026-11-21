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
| `STORE` | `redis` (RedisStore·AES-GCM 구현 전에는 `memory`) |
| `CLOVASTUDIO_API_KEY` | CLOVA Studio 키 |
| `CLOVA_MODEL` | `HCX-007` |
| `REDIS_URL` | Cloud DB for Cache 사설 주소 |
| `ENCRYPTION_KEY` | 32바이트 키(base64). Secret Manager 보관 권장 |

## 주의

- `STORE=redis`로 바꾸기 전에 `lib/store.ts`의 RedisStore와 `lib/crypto.ts`의 AES-GCM을 구현한다. 구현 전에는 일부러 오류가 난다(평문 저장 방지).
- Nginx 접근 로그는 끈다(주소에 토큰이 있음). 앱 로그는 `lib/log.ts`만 사용.
- 키는 채팅·커밋에 올리지 않는다.
