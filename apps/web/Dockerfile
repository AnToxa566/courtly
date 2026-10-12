# Build context is the repository root: docker compose builds with `context: .`.

FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @courtly/web -w @courtly/contracts

# The web build reads contracts source directly (see vite.config.ts), so it
# does not need the contracts build.
COPY packages/contracts/src packages/contracts/src
COPY apps/web apps/web
RUN npm run build -w @courtly/web

FROM nginx:1.30.5-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
