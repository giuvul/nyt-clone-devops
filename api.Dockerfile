# Back end: il proxy verso le API del NYT come server Node senza dipendenze.
# In produzione lo stesso codice gira come Netlify Function.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787

# Solo i file che servono: package.json (per "type": "module"), il server e
# l'elenco delle sezioni ammesse. Nessun npm install: usa solo moduli di Node.
COPY package.json ./
COPY server/index.js server/nytProxy.js ./server/
COPY src/config/sections.js ./src/config/

# Mai come root dentro il container.
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "server/index.js"]
