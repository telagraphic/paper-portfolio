# syntax=docker/dockerfile:1
# Node 24 matches development and tests; node:sqlite needs no flag here. Bump the tag and digest together.
ARG NODE_IMAGE=node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ${NODE_IMAGE}
LABEL org.opencontainers.image.title="paper-portfolio" \
      org.opencontainers.image.source="https://github.com/telagraphic/paper-portfolio"
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/book.sqlite \
    CLIENT_DIR=/app/dist/client
WORKDIR /app
# The server imports only node: modules, so the run stage needs no node_modules.
# package.json stays for "type": "module".
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
# A new named volume copies this ownership on first mount.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server/index.js"]
