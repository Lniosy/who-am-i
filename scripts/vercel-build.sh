#!/usr/bin/env bash
set -euo pipefail
echo "PWD=$PWD"
mkdir -p public

SITE=""
for d in . .. ../.. ../../.. /vercel/path0; do
  if [ -f "$d/site/index.html" ]; then
    SITE="$d/site"
    break
  fi
done

echo "SITE=${SITE:-}"
if [ -n "$SITE" ]; then
  cp -R "$SITE"/. public/
elif [ -f index.html ]; then
  cp index.html public/
  [ -f 404.html ] && cp 404.html public/
  [ -f dashboard-preview.jpg ] && cp dashboard-preview.jpg public/
else
  echo "cannot find site/index.html"
  ls -la
  ls -la .. || true
  ls -la ../.. || true
  exit 1
fi

ls -la public
test -f public/index.html
