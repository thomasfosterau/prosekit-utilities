#!/usr/bin/env bash
# Publish every workspace package whose version is not yet on npm, then tag.
# `pnpm pack` rewrites `workspace:*` / `catalog:` to real ranges; `npm publish`
# of the tarball does the OIDC trusted publishing. Every tarball is packed
# before the first publish, and a version already on npm is skipped, so a
# partial run can be re-run. Never add `--provenance`: it fails from a private
# repository.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

# Workspace packages (not the private root) in dependency order: `pnpm -r`
# walks the workspace graph topologically, and one-at-a-time keeps it so.
mapfile -t dirs < <(pnpm -r --workspace-concurrency=1 exec pwd)

pending=()
for dir in "${dirs[@]}"; do
  name="$(node -p "require('$dir/package.json').name")"
  version="$(node -p "require('$dir/package.json').version")"
  if npm view "$name@$version" version >/dev/null 2>&1; then
    echo "skip: $name@$version is already published"
    continue
  fi
  echo "pack: $name@$version"
  # `pnpm pack` has no `--ignore-scripts` flag; pass it as config.
  (cd "$dir" && pnpm pack --config.ignore-scripts=true --out package.tgz >/dev/null)
  pending+=("$dir")
done

for dir in "${pending[@]}"; do
  echo "publish: $dir/package.tgz"
  # A tarball spec runs no lifecycle scripts under `npm publish`.
  (cd "$dir" && npm publish package.tgz --access public)
done

# Emits the `New tag:` lines the Changesets action parses to push the tags
# and create the GitHub releases.
changeset tag
