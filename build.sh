#!/bin/sh

set -eu

directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
bundle=$(mktemp "${TMPDIR:-/tmp}/microlighter.XXXXXX.js")
output="$directory/microlighter.min.js"

trap 'rm -f "$bundle"' EXIT

npx --yes rollup@4.46.2 "$directory/src/index.js" \
  --format esm \
  --file "$bundle" \
  --silent

npx --yes terser@5.43.1 "$bundle" \
  --compress \
  --mangle \
  --module \
  --comments false \
  --output "$output"

gzip_size=$(gzip -9 -n -c "$output" | wc -c | tr -d ' ')

printf '%s: %s bytes\n' "$(basename "$output")" "$(wc -c < "$output" | tr -d ' ')"
printf '%s gzip: %s bytes\n' "$(basename "$output")" "$gzip_size"
