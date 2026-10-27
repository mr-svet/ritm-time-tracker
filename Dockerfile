FROM node:24.22.1-bookworm-slim AS feedback-build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tools/agentation-ui.mjs tools/build-agentation.mjs ./tools/
RUN npm run build:agentation

FROM node:24.22.1-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATA_DIR=/app/data
WORKDIR /app
COPY package.json index.html app.mjs domain.mjs storage.mjs remote.mjs telegram.mjs telegram-platform.mjs form-drafts.mjs sync-view.mjs i18n.mjs styles.css mobile.css favicon.svg ./
COPY assets/rhythm-forest.png ./assets/rhythm-forest.png
COPY assets/scenes/ ./assets/scenes/
COPY landing/ ./landing/
COPY server/ ./server/
COPY --from=feedback-build /build/agentation/panel.mjs ./agentation/panel.mjs
COPY tools/security.mjs tools/healthcheck.mjs tools/backup.mjs tools/db-entries.mjs ./tools/
RUN mkdir -p /app/data /app/backups && chown node:node /app/data /app/backups && chmod 700 /app/data /app/backups
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "tools/healthcheck.mjs"]
CMD ["node", "server/start.mjs"]
