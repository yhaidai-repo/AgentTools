# One image for migrate, worker, agent-runner and web. Build context: the AgentTools folder (see docker-compose.yml).
FROM node:24-alpine
# Node's connection racing (autoselect family) times out on this Docker network; plain connect works.
ENV NODE_OPTIONS=--no-network-family-autoselection \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache git
# PowerShell 7 (musl build) for the VaultCapture module, which the worker calls to save vault drafts.
ARG PWSH_VERSION=7.6.6
RUN apk add --no-cache ca-certificates less ncurses-terminfo-base krb5-libs libgcc libintl libssl3 libstdc++ tzdata userspace-rcu zlib icu-libs  && wget -q -O /tmp/pwsh.tar.gz https://github.com/PowerShell/PowerShell/releases/download/v${PWSH_VERSION}/powershell-${PWSH_VERSION}-linux-musl-x64.tar.gz  && mkdir -p /opt/microsoft/powershell/7 && tar zxf /tmp/pwsh.tar.gz -C /opt/microsoft/powershell/7  && chmod +x /opt/microsoft/powershell/7/pwsh && ln -s /opt/microsoft/powershell/7/pwsh /usr/bin/pwsh && rm /tmp/pwsh.tar.gz
WORKDIR /app
COPY package.json package-lock.json ./
COPY AgentConfig/package.json AgentConfig/
COPY AgentRuntime/package.json AgentRuntime/
COPY AgentUsage/package.json AgentUsage/
COPY Adoa/packages/db/package.json Adoa/packages/db/
COPY Adoa/packages/core/package.json Adoa/packages/core/
COPY Adoa/packages/ado/package.json Adoa/packages/ado/
COPY Adoa/packages/vault/package.json Adoa/packages/vault/
COPY Adoa/packages/attachments/package.json Adoa/packages/attachments/
COPY Adoa/packages/notes/package.json Adoa/packages/notes/
COPY Adoa/packages/agents/package.json Adoa/packages/agents/
COPY Adoa/apps/worker/package.json Adoa/apps/worker/
COPY Adoa/apps/agent-runner/package.json Adoa/apps/agent-runner/
COPY Adoa/apps/web/package.json Adoa/apps/web/
RUN npm ci --no-fund --no-audit
COPY AgentConfig AgentConfig
COPY AgentRuntime AgentRuntime
COPY AgentUsage AgentUsage
COPY VaultCapture VaultCapture
COPY Adoa Adoa
RUN npm run build -w @adoa/web
