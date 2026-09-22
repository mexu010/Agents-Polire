FROM node:24.14.0-bookworm-slim
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=4330 DATA_DIR=/app/data
EXPOSE 4330
VOLUME ["/app/data"]
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:4330/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "cli.mjs", "start"]
