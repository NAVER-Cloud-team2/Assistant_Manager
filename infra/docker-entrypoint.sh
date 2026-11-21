#!/bin/sh
# 운영 이미지 시작 검사 (담당: D). infra/Dockerfile의 ENTRYPOINT.
# NODE_ENV=production 에서는 STORE 종류와 무관하게 ENCRYPTION_KEY가 필요하다 (lib/crypto.ts와 같은 정책).
# 키가 비어 있으면 앱을 띄우지 않고 종료한다. 키 값은 절대 출력하지 않는다.
# 형식(표준 base64, 32바이트)은 lib/crypto.ts가 첫 사용 때 검사한다.
set -eu

if [ "${NODE_ENV:-}" = "production" ]; then
  key_trimmed=$(printf '%s' "${ENCRYPTION_KEY:-}" | tr -d '[:space:]')
  if [ -z "$key_trimmed" ]; then
    echo "시작 중단: NODE_ENV=production 에서는 ENCRYPTION_KEY가 필요합니다 (STORE=memory여도 필수). infra/README.md 참고" >&2
    exit 78
  fi
  unset key_trimmed
fi

exec "$@"
