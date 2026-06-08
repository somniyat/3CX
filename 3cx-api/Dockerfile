# ── Build stage ───────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copier d'abord le module local (dependance file:)
COPY 3cxModule/ ./3cxModule/

# Installer et builder le module
WORKDIR /app/3cxModule
RUN npm ci && npm run build

# Installer et builder l'API
WORKDIR /app/3cx-api
COPY 3cx-api/package*.json ./
RUN npm ci
COPY 3cx-api/ ./
RUN npm run build

# ── Production stage ─────────────────────────────────────────
FROM node:22-alpine AS production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copier le module build
COPY --from=build /app/3cxModule/ ./3cxModule/

# Copier l'API buildee et les node_modules
COPY --from=build /app/3cx-api/dist ./dist
COPY --from=build /app/3cx-api/node_modules ./node_modules
COPY --from=build /app/3cx-api/package.json ./

# Creer le dossier data pour les drivers (fichier JSON)
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1

CMD ["node", "dist/index.js"]
