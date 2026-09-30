# One image for migrate, worker and web. Build context: repo root.
FROM node:24-alpine
# Node's connection racing (autoselect family) times out on this Docker network; plain connect works.
ENV NODE_OPTIONS=--no-network-family-autoselection \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache git
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/ado/package.json packages/ado/
COPY packages/vault/package.json packages/vault/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN npm ci --no-fund --no-audit
COPY . .
RUN npm run build -w @adoa/web
