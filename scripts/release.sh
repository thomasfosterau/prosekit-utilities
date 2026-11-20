#!/usr/bin/env bash
# Publish every workspace package whose version is not yet on npm, then tag.
# `pnpm pack` rewrites `workspace:*` / `catalog:` to real ranges; `pnpm publish`
# of the tarball does the OIDC trusted publishing, with no npm CLI and no
# NPM_TOKEN. Every tarball is packed before the first publish, and a version
# already on npm is skipped, so a partial run can be re-run. Never add
# `--provenance`: pnpm attaches it itself for a public repository, and forcing
# it from a private one fails.

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
  # pnpm reports an unpublished version as ERR_PNPM_PACKAGE_NOT_FOUND and a
  # never-published package as ERR_PNPM_FETCH_404; any other failure stops here.
  if view="$(pnpm view "$name@$version" version 2>&1)"; then
    echo "skip: $name@$version is already published"
    continue
  elif ! grep -qE 'ERR_PNPM_(PACKAGE_NOT_FOUND|FETCH_404)' <<<"$view"; then
    echo "$view" >&2
    exit 1
  fi
  echo "pack: $name@$version"
  # `pnpm pack` has no `--ignore-scripts` flag; pass it as config.
  (cd "$dir" && pnpm pack --config.ignore-scripts=true --out package.tgz >/dev/null)
  pending+=("$dir")
done

for dir in "${pending[@]}"; do
  echo "publish: $dir/package.tgz"
  # The default `publishBranch` is `main` / `master`, not `trunk`.
  (cd "$dir" && pnpm publish package.tgz --access public --no-git-checks --ignore-scripts)
done

# Emits the `New tag:` lines the Changesets action parses to push the tags
# and create the GitHub releases.
changeset tag
