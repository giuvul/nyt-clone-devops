# Front end: build React con Node, poi file statici serviti da nginx.
# Multi-stage: l'immagine finale contiene solo nginx e la cartella dist
# (niente Node, niente node_modules, niente sorgenti).

# ---- 1. build ----
FROM node:22-alpine AS build
WORKDIR /app

# Prima solo i manifest: se non cambiano, Docker riusa la cache di npm ci.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Variabili pubbliche del front end, lette da Vite al momento della build.
# Il DSN di Sentry non è un segreto (finisce comunque nel JavaScript del
# browser); la chiave NYT invece non entra mai qui: resta al servizio "api".
ARG VITE_SENTRY_DSN=""
ARG VITE_SENTRY_ENVIRONMENT="development"
ARG VITE_RELEASE="local"
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT \
    VITE_RELEASE=$VITE_RELEASE
RUN npm run build && find dist -name "*.map" -delete

# ---- 2. runtime ----
# Variante "unprivileged": nginx gira come utente non root sulla porta 8080.
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
