#!/bin/sh
# Every local file the page and the 3D scene refer to must exist.
cd "$(dirname "$0")/../site" || exit 1
errors=0
missing() { echo "missing: $1 ($2)"; errors=$((errors + 1)); }

for f in index.html scene.js; do
  [ -f "$f" ] || missing "$f" "site"
done
for f in $(grep -oE '(src|href)="[^"#:]+"' index.html | sed -E 's/^[a-z]+="//; s/"$//' | grep -v '^/' | sort -u); do
  [ -f "$f" ] || missing "$f" "index.html"
done
for f in $(grep -oE "url\((img/[^)]+)\)" index.html | sed -E 's/^url\(//; s/\)$//' | sort -u); do
  [ -f "$f" ] || missing "$f" "index.html"
done
models=$(sed -n "s/.*const list = \[\(.*\)\];.*/\1/p" scene.js | tr -d "' " | tr ',' ' ')
[ -n "$models" ] || { echo "no model list found in scene.js"; errors=$((errors + 1)); }
for m in $models sky_disc; do
  [ -f "models/$m.glb" ] || missing "models/$m.glb" "scene.js"
done
for f in models/*.glb; do
  name=$(basename "$f" .glb)
  grep -q "'$name'" scene.js || missing "use of $f" "scene.js"
done

[ "$errors" -eq 0 ] || exit 1
echo ok
