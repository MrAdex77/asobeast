FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV TURBO_TELEMETRY_DISABLED=1
RUN corepack enable && apk add --no-cache libc6-compat openssl

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN pnpm dlx turbo@^2 prune api --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /repo/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=api

FROM base AS runner
WORKDIR /repo
COPY --from=builder /repo .
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && (npx prisma db seed || true) && node dist/main.js"]
