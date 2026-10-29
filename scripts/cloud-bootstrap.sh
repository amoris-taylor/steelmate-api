#!/usr/bin/env bash
# One-time cloud setup helper (run from steelmate-api repo root).
# Requires: vercel CLI (logged in), psql (for schema), env file with secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.vercel}"

if [[ ! -f "$ENV_FILE" ]]; then
  cat <<EOF
Missing $ENV_FILE

Copy scripts/env.vercel.example to .env.vercel and fill in values from:
  Clerk dashboard, Vercel Neon integration (pooled DATABASE_URL),
  Vercel Upstash integration (REST URL + token).

Then re-run: ./scripts/cloud-bootstrap.sh
EOF
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required=(
  CLERK_SECRET_KEY
  DATABASE_URL
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  CATALOG_VERSION
  ALLOWED_ORIGINS
)
for v in "${required[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "Missing $v in $ENV_FILE"
    exit 1
  fi
done

echo "Applying Postgres schema..."
psql "$DATABASE_URL" -f "$ROOT/drizzle/0000_init.sql"

echo "Setting Vercel env on steelmate-api (production + preview)..."
cd "$ROOT"
for env in production preview; do
  for v in "${required[@]}"; do
    printf '%s' "${!v}" | vercel env add "$v" "$env" --force 2>/dev/null || \
      printf '%s' "${!v}" | vercel env add "$v" "$env"
  done
done

echo "Deploy API..."
vercel deploy --prod --yes

echo ""
echo "Next: set on steelmate Vercel project:"
echo "  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY,"
echo "  NEXT_PUBLIC_STEELMATE_API_URL=<API production URL from above>"
echo "Then update ALLOWED_ORIGINS here to include the web URL and redeploy API."
