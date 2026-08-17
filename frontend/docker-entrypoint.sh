#!/bin/sh
# Runs automatically before nginx starts (nginx:alpine executes every executable script under
# /docker-entrypoint.d/). Overwrites the checked-in localhost defaults in config.json with the
# container's actual environment — same pattern as musik-star's/planning-poker's frontends.
set -eu

CONFIG_PATH="/usr/share/nginx/html/config.json"

: "${BASE_URL:?BASE_URL must be set}"
: "${API_URL:?API_URL must be set}"
: "${AUTH_URL:?AUTH_URL must be set}"
: "${CLIENT_ID:?CLIENT_ID must be set}"
: "${FEATURE_SSO:=true}"
: "${FEATURE_REGISTRATION:=true}"

cat > "$CONFIG_PATH" <<EOF
{
  "baseUrl": "${BASE_URL}",
  "apiUrl": "${API_URL}",
  "authUrl": "${AUTH_URL}",
  "clientId": "${CLIENT_ID}",
  "features": {
    "sso": ${FEATURE_SSO},
    "registration": ${FEATURE_REGISTRATION}
  }
}
EOF

echo "Wrote runtime config to ${CONFIG_PATH}:"
cat "$CONFIG_PATH"
