#!/bin/zsh
# Runs the full security suite against a throwaway local copy of the site, database and private storage.
# Nothing here touches your real Cloudflare account.   Usage:  tests/run-local.sh
cd "$(dirname "$0")/.." || exit 1
STATE=$(mktemp -d); export STATE
[ -f .dev.vars ] || printf 'CODE_PEPPER=%s\n' "$(openssl rand -hex 32)" > .dev.vars
w() { npx -y wrangler@4 "$@"; }
w d1 migrations apply portfolio-access --local --persist-to "$STATE" >/dev/null 2>&1 || { echo "could not create the local database"; exit 1; }
D=sample-content/un-escap-risk-portal; K=projects/un-escap-risk-portal
put() { w kv key put --binding CONTENT --local --persist-to "$STATE" "$1" --path "$2" --metadata "{\"contentType\":\"$3\"}" >/dev/null 2>&1; }
put $K/content.html $D/content.html text/html; put $K/meta.json $D/meta.json application/json; put $K/assets/01-hero.svg $D/assets/01-hero.svg image/svg+xml
# A second project that has a title but no page yet, to test codes that unlock two projects.
printf '{ "title": "Digital Assets Management System" }' > "$STATE/meta2.json"
put projects/digital-assets-management/meta.json "$STATE/meta2.json" application/json
rc=0
for mode in open closed; do
  extra=(); [ $mode = open ] && extra=(--binding DEV_BYPASS_ADMIN=1)
  pkill -f workerd 2>/dev/null; sleep 1
  w pages dev . --port 8788 --persist-to "$STATE" $extra > "$STATE/dev-$mode.log" 2>&1 &
  until curl -s -o /dev/null localhost:8788/robots.txt; do sleep 1; done
  echo "=== mode: $mode"; node tests/security.mjs $mode || rc=1
  pkill -f "wrangler.*pages dev"; pkill -f workerd 2>/dev/null; sleep 1
done
rm -rf "$STATE"; exit $rc
