#!/usr/bin/env bash
# Controlla la cartella dist prima del deploy: nessun segreto deve finire nei
# file pubblici. Non stampa mai il valore della chiave, solo l'esito.
set -euo pipefail

DIST="${1:-dist}"
status=0

if [ -n "${NYT_API_KEY:-}" ] && grep -rqF -- "$NYT_API_KEY" "$DIST"; then
  echo "::error::The NYT API key was found in $DIST"
  status=1
else
  echo "OK: the NYT API key is not in $DIST"
fi

if grep -rqE "NYT_API_KEY|SENTRY_AUTH_TOKEN|NETLIFY_AUTH_TOKEN" "$DIST"; then
  echo "::error::A server-side variable name was found in $DIST"
  status=1
else
  echo "OK: no server-side variable in $DIST"
fi

if find "$DIST" -name "*.map" | grep -q .; then
  echo "::error::Source maps are still in $DIST (they must be uploaded to Sentry and removed)"
  status=1
else
  echo "OK: no source maps in $DIST"
fi

exit "$status"
