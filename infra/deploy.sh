#!/usr/bin/env bash
# 스테이징 서버에서 새 이미지로 재시작 (담당: D)
# 서버에 /srv/assistant-manager/deploy.sh 로 두고, 환경 변수는 /srv/assistant-manager/.env 에 둔다.
# 서버에서 한 번: docker login <NCR_REGISTRY> (API 인증키로 로그인)
# 키 값은 어떤 경우에도 출력하지 않는다.
set -euo pipefail

IMAGE="${1:?사용법: deploy.sh <이미지:태그>}"
NAME=assistant-manager
ENV_FILE="${ENV_FILE:-/srv/assistant-manager/.env}"

# --- 배포 전 확인: 기존 컨테이너를 내리기 전에 멈춘다 ---
if [ ! -r "$ENV_FILE" ]; then
  echo "배포 중단: $ENV_FILE 을 읽을 수 없습니다" >&2
  exit 1
fi
# 운영 이미지는 STORE와 무관하게 ENCRYPTION_KEY가 필요하다.
# docker --env-file은 따옴표를 값에 그대로 넣으므로, 따옴표 없는 표준 base64 32바이트(44자)만 통과시킨다.
if ! grep -Eq '^ENCRYPTION_KEY=[A-Za-z0-9+/]{43}=[[:space:]]*$' "$ENV_FILE"; then
  echo "배포 중단: $ENV_FILE 에 ENCRYPTION_KEY가 없거나 형식이 다릅니다 (따옴표 없이 openssl rand -base64 32 값). infra/README.md 참고" >&2
  exit 1
fi

docker pull "$IMAGE"
docker rm -f "$NAME" 2>/dev/null || true
docker run -d --name "$NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p 127.0.0.1:3000:3000 \
  --log-opt max-size=10m --log-opt max-file=3 \
  "$IMAGE"

# --- 배포 후 확인: 시작 검사에서 멈추면 재시작이 반복되므로 상태와 재시작 횟수를 본다 ---
sleep "${DEPLOY_CHECK_SECONDS:-5}"
state=$(docker inspect -f '{{.State.Running}} {{.RestartCount}}' "$NAME" 2>/dev/null || echo "missing 0")
if [ "$state" != "true 0" ]; then
  echo "배포 실패: 컨테이너가 정상 실행 중이 아닙니다 (상태: $state). 최근 로그:" >&2
  docker logs --tail 20 "$NAME" >&2 || true
  exit 1
fi

docker image prune -f >/dev/null
echo "deployed $IMAGE"
