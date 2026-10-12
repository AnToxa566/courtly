# Build context is the repository root: docker compose builds with `context: .`.

FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app

# Prisma's schema engine is a native binary picked at install time by the
# OpenSSL version it detects. The slim image has none, so install it here.
# The runtime stage does not need it: the query compiler is WASM.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @courtly/api -w @courtly/contracts

COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w @courtly/contracts && npm run build -w @courtly/api

FROM node:24.19.0-bookworm-slim AS runtime
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# --omit=dev alone keeps `prisma` (and typescript with it): it is an optional
# peer of @prisma/client, so npm drops it only when optional is omitted too.
RUN npm ci --omit=dev --omit=optional -w @courtly/api -w @courtly/contracts \
  && npm cache clean --force

COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/apps/api/dist apps/api/dist

USER node
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
