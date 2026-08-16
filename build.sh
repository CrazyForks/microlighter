#!/bin/sh

set -eu

directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
dist="$directory/dist"
bundle="$dist/microlighter.js"
minified_bundle="$dist/microlighter.min.js"
element_bundle="$dist/micro-lighter-element.js"
minified_element_bundle="$dist/micro-lighter-element.min.js"

# Populate dist/ with the hand-authored ESM source (no transpile needed).
rm -rf "$dist"
mkdir -p "$dist"
cp -R "$directory/src/." "$dist/"

npx --yes esbuild@0.25.8 "$directory/src/grammars/"*.js \
  --minify-whitespace \
  --outdir="$dist/grammars" \
  --log-level=warning

npx --yes esbuild@0.25.8 "$directory/src/themes/"*.css \
  --minify-whitespace \
  --outdir="$dist/themes" \
  --log-level=warning

npx --yes rollup@4.46.2 "$directory/src/microlighter.js" \
  --format esm \
  --file "$bundle" \
  --silent

npx --yes terser@5.43.1 "$bundle" \
  --compress \
  --mangle \
  --module \
  --comments false \
  --output "$minified_bundle"

npx --yes rollup@4.46.2 "$directory/src/micro-lighter-element.js" \
  --format esm \
  --file "$element_bundle" \
  --silent

npx --yes terser@5.43.1 "$element_bundle" \
  --compress \
  --mangle \
  --module \
  --comments false \
  --output "$minified_element_bundle"

# Vendor the built package into the docs/ site so GitHub Pages (source: /docs)
# can serve a self-contained demo that loads the real distributable.
rm -rf "$directory/docs/microlighter"
mkdir -p "$directory/docs/microlighter"
cp -R "$dist/." "$directory/docs/microlighter/"

node "$directory/scripts/report-size.mjs"
