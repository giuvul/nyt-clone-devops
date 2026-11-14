#!/usr/bin/env bash
# Dopo `npm run build`: crea la release su Sentry, carica le source map e le
# cancella da dist, così gli stack trace su Sentry sono leggibili ma il codice
# sorgente non finisce sul sito pubblico.
#
# Variabili: SENTRY_AUTH_TOKEN (GitHub Secret), SENTRY_ORG e SENTRY_PROJECT
# (GitHub Variables), VITE_RELEASE (SHA del commit). Senza token salta
# l'upload e cancella comunque le mappe.
set -euo pipefail

DIST="${1:-dist}"

if [ -z "${SENTRY_AUTH_TOKEN:-}" ] || [ -z "${SENTRY_ORG:-}" ] || [ -z "${SENTRY_PROJECT:-}" ]; then
  echo "Sentry token or project not configured: source maps are not uploaded."
else
  : "${VITE_RELEASE:?VITE_RELEASE must be the commit SHA}"
  # sentry-cli legge SENTRY_AUTH_TOKEN, SENTRY_ORG e SENTRY_PROJECT
  # dall'ambiente: il token non compare mai sulla riga di comando.
  npx sentry-cli releases new "$VITE_RELEASE"
  # Inserisce un debug id in ogni file JS e nella sua mappa (aggiornando
  # anche le posizioni), così Sentry abbina ogni file alla mappa giusta.
  npx sentry-cli sourcemaps inject "$DIST"
  npx sentry-cli sourcemaps upload --release "$VITE_RELEASE" "$DIST"
  npx sentry-cli releases finalize "$VITE_RELEASE"
fi

find "$DIST" -name "*.map" -delete
echo "Source maps removed from $DIST"
