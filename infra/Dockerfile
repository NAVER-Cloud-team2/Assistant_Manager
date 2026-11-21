# 대리총무 — Next.js standalone 이미지 (담당: D)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
# 시작 검사: 운영(NODE_ENV=production)에서 ENCRYPTION_KEY가 없으면 앱을 띄우지 않는다.
# 키는 이미지에 넣지 않고 실행할 때 환경 변수로만 받는다 (--env-file / compose environment).
# Windows에서 체크아웃해 CRLF가 섞여도 동작하도록 줄끝을 정리한다.
COPY infra/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod 0755 /usr/local/bin/docker-entrypoint.sh
USER app
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
