#!/usr/bin/env bash
#
# Publish every workspace package whose version is not yet on npm, then tag.
#
# Run by the Release workflow (changesets/action `publish-script`, via the
# root `release` script) once the "Version Packages" PR has merged.
#
# Two tools, deliberately: `pnpm pack` is what rewrites the `workspace:*` and
# `catalog:` specifiers to real ranges in the packed manifest, and `npm
# publish` of the resulting tarball is what performs npm OIDC trusted
# publishing (npm >= 11.5.1; the Release job pins one). No `--provenance`:
# npm attaches it by itself once the repository and the package are both
# public, and an explicit request from a private repository fails the
# publish.
#
# pnpm 11's own `pnpm publish` also performs trusted publishing; this script
# keeps `pnpm pack` + `npm publish` by choice until the first release has gone
# out (switching is evaluated in #31).
#
# Idempotent: a package already published at its current version is skipped,
# so a partial run can be re-run, and a version bootstrapped by hand does not
# fail the automated run. Every tarball is packed before the first publish,
# so a pack failure publishes nothing.

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
  # `--config.ignore-scripts=true`: no `prepack` / `prepare` / `postpack` runs
  # in the id-token job (none is defined today). `pnpm pack` has no
  # `--ignore-scripts` flag (pnpm 11 rejects it as an unknown option), so the
  # setting is passed as config; the tarball is byte-identical either way.
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
