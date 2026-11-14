#!/usr/bin/env bash
# Verifica dopo il deploy: il sito risponde e la Netlify Function raggiunge
# davvero le API del NYT (quindi la chiave è configurata).
set -euo pipefail

URL="${1:?usage: post-deploy-check.sh <url>}"

for attempt in 1 2 3 4 5; do
  home=$(curl -s -o /dev/null -w '%{http_code}' "$URL/")
  api=$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/topstories/home")
  echo "attempt $attempt: / -> $home, /api/topstories/home -> $api"
  if [ "$home" = "200" ] && [ "$api" = "200" ]; then
    echo "Deploy is live: $URL"
    exit 0
  fi
  sleep 10
done

echo "::error::$URL is not answering correctly after the deploy"
exit 1
