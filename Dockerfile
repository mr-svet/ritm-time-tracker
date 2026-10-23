FROM node:24.21.0-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATA_DIR=/app/data
WORKDIR /app
COPY package.json index.html app.mjs domain.mjs storage.mjs remote.mjs i18n.mjs styles.css favicon.svg ./
COPY assets/rhythm-forest.png ./assets/rhythm-forest.png
COPY assets/scenes/ ./assets/scenes/
COPY server/ ./server/
COPY tools/security.mjs tools/healthcheck.mjs tools/backup.mjs tools/db-entries.mjs ./tools/
RUN mkdir -p /app/data /app/backups && chown node:node /app/data /app/backups && chmod 700 /app/data /app/backups
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "tools/healthcheck.mjs"]
CMD ["node", "server/start.mjs"]
