FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS dependencies
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm config set fetch-timeout 300000 \
  && pnpm config set fetch-retries 5 \
  && pnpm install --frozen-lockfile

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS builder
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_APP_BASE_PATH=/personalized-secure
ARG NEXT_PUBLIC_PERSONALIZED_AUTH_BASE=/personalized-secure-api
ARG NEXT_PUBLIC_PERSONALIZED_V2_API_BASE=/personalized-secure-api/v1
ARG NEXT_PUBLIC_PERSONALIZED_SERVICE_BASE=/personalized-secure-api/v1
ENV NEXT_PUBLIC_APP_BASE_PATH=$NEXT_PUBLIC_APP_BASE_PATH
ENV NEXT_PUBLIC_PERSONALIZED_AUTH_BASE=$NEXT_PUBLIC_PERSONALIZED_AUTH_BASE
ENV NEXT_PUBLIC_PERSONALIZED_V2_API_BASE=$NEXT_PUBLIC_PERSONALIZED_V2_API_BASE
ENV NEXT_PUBLIC_PERSONALIZED_SERVICE_BASE=$NEXT_PUBLIC_PERSONALIZED_SERVICE_BASE
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3402

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3402
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/personalized-secure/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
