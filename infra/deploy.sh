#!/usr/bin/env bash
# 스테이징 서버에서 새 이미지로 재시작 (담당: D)
# 서버에 /srv/assistant-manager/deploy.sh 로 두고, 환경 변수는 /srv/assistant-manager/.env 에 둔다.
# 서버에서 한 번: docker login <NCR_REGISTRY> (API 인증키로 로그인)
set -euo pipefail

IMAGE="${1:?사용법: deploy.sh <이미지:태그>}"
NAME=assistant-manager
ENV_FILE=/srv/assistant-manager/.env

docker pull "$IMAGE"
docker rm -f "$NAME" 2>/dev/null || true
docker run -d --name "$NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p 127.0.0.1:3000:3000 \
  --log-opt max-size=10m --log-opt max-file=3 \
  "$IMAGE"
docker image prune -f >/dev/null
echo "deployed $IMAGE"
