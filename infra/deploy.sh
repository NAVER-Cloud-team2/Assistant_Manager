#!/usr/bin/env bash
# 서버에서 대리총무 재배포 (담당: D). 키 값은 어떤 경우에도 출력하지 않는다.
#
# 사용법 (서버, root):
#   /srv/assistant-manager/deploy.sh --build        ← 지금 서버 방식: src를 git pull 한 뒤 서버에서 빌드
#   /srv/assistant-manager/deploy.sh <이미지:태그>   ← Container Registry 방식 (.github/workflows/deploy.yml, 지금은 쓰지 않음)
#
# 순서: .env 검사 → 새 이미지 준비 → 기존 컨테이너 교체 → 상태 확인 → 실패하면 이전 이미지로 되돌림
# 테스트용으로 ENV_FILE·SRC_DIR·DEPLOY_CHECK_SECONDS·KEEP_IMAGES를 바꿀 수 있다.
set -euo pipefail

NAME=assistant-manager
BASE=/srv/assistant-manager
ENV_FILE="${ENV_FILE:-$BASE/.env}"
SRC_DIR="${SRC_DIR:-$BASE/src}"
KEEP_IMAGES="${KEEP_IMAGES:-3}"

usage() {
  echo "사용법: deploy.sh --build | deploy.sh <이미지:태그>" >&2
  exit 2
}
[ $# -eq 1 ] || usage

# --- 1. .env 검사: 기존 컨테이너를 건드리기 전에 멈춘다 ---
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
if grep -Eq '^STORE=redis[[:space:]]*$' "$ENV_FILE" && ! grep -Eq '^REDIS_URL=.+' "$ENV_FILE"; then
  echo "배포 중단: STORE=redis인데 REDIS_URL이 없습니다" >&2
  exit 1
fi
# AI 키가 없으면 AI 추출만 실패하고 직접 입력으로 넘어간다 → 멈추지 않고 경고만
if grep -Eq '^MOCK_AI=0[[:space:]]*$' "$ENV_FILE" && ! grep -Eq '^OPENAI_API_KEY=.+' "$ENV_FILE"; then
  echo "경고: MOCK_AI=0인데 OPENAI_API_KEY가 없습니다. AI 추출 없이 직접 입력으로만 동작합니다" >&2
fi

# --- 2. 새 이미지 준비 ---
if [ "$1" = "--build" ]; then
  if [ ! -d "$SRC_DIR/.git" ]; then
    echo "배포 중단: $SRC_DIR 에 저장소가 없습니다 (git clone 먼저, infra/README.md 참고)" >&2
    exit 1
  fi
  git -C "$SRC_DIR" pull --ff-only
  IMAGE="$NAME:$(git -C "$SRC_DIR" rev-parse --short HEAD)"
  docker build -f "$SRC_DIR/infra/Dockerfile" -t "$IMAGE" "$SRC_DIR"
else
  case "$1" in -*) usage ;; esac
  IMAGE="$1"
  docker pull "$IMAGE"
fi

# --- 3. 교체 (실패하면 되돌릴 이전 이미지를 기억해 둔다) ---
PREV=$(docker inspect -f '{{.Config.Image}}' "$NAME" 2>/dev/null || true)

start() {
  docker run -d --name "$NAME" \
    --restart unless-stopped \
    --env-file "$ENV_FILE" \
    -p 127.0.0.1:3000:3000 \
    --log-opt max-size=10m --log-opt max-file=3 \
    "$1" >/dev/null
}
# 시작 검사(키 누락)에서 멈추면 재시작이 반복되므로 실행 상태·재시작 횟수와 실제 응답을 같이 본다
healthy() {
  sleep "${DEPLOY_CHECK_SECONDS:-5}"
  local state
  state=$(docker inspect -f '{{.State.Running}} {{.RestartCount}}' "$NAME" 2>/dev/null || echo "missing 0")
  [ "$state" = "true 0" ] && curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:3000/
}

docker rm -f "$NAME" >/dev/null 2>&1 || true
start "$IMAGE"

# --- 4. 확인, 실패하면 이전 이미지로 되돌림 ---
if ! healthy; then
  echo "배포 실패: 새 컨테이너가 정상 응답하지 않습니다. 최근 로그:" >&2
  docker logs --tail 20 "$NAME" >&2 || true
  if [ -n "$PREV" ] && [ "$PREV" != "$IMAGE" ]; then
    echo "이전 이미지($PREV)로 되돌립니다" >&2
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    start "$PREV"
    if healthy; then echo "되돌림 완료: $PREV 로 서비스 중" >&2; else echo "되돌림도 실패했습니다. docker logs $NAME 확인" >&2; fi
  fi
  exit 1
fi

# --- 5. 정리: 서버 빌드 이미지는 최근 KEEP_IMAGES개만 남긴다 (실행 중인 이미지는 지우지 않음) ---
if [ "$1" = "--build" ]; then
  docker images "$NAME" --format '{{.Repository}}:{{.Tag}}' | tail -n +"$((KEEP_IMAGES + 1))" | grep -vxF "$IMAGE" |
    xargs -r docker rmi >/dev/null 2>&1 || true
fi
docker image prune -f >/dev/null
echo "deployed $IMAGE"
