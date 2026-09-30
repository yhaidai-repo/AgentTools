# One-shot migration runner. Build context: repo root.
FROM node:24-alpine
# Node's connection racing (autoselect family) times out on this Docker network; plain connect works.
ENV NODE_OPTIONS=--no-network-family-autoselection
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
RUN npm ci --workspace @adoa/db --no-fund --no-audit
COPY packages/db packages/db
CMD ["npm", "run", "migrate", "-w", "@adoa/db"]
