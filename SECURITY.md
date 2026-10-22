# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub's [**Report a vulnerability**](https://github.com/thomasfosterau/prosekit-utilities/security/advisories/new) button (Security → Advisories), **not** a public issue. Include a description, reproduction steps and the affected package and version; expect a first response within a few days.

These packages render and sanitise user-authored documents, so the reports most worth sending are ones that get markup or a `javascript:` URL past `createHtmlRenderer`'s sanitiser or `isSafeHref`, out of the flowchart's `data-payload` attribute, or past an allow-list check.

## Supply-chain hardening

- **No long-lived npm token.** Releases use npm [OIDC trusted publishing](https://docs.npmjs.com/trusted-publishers) from a protected `release` environment that requires manual approval ([PUBLISHING.md](PUBLISHING.md)).
- **Install scripts off where it matters.** The release job installs with `pnpm install --frozen-lockfile --ignore-scripts` and sets `pnpm_config_verify_deps_before_run: 'false'`, so no later `pnpm run` can re-install with scripts in the job that holds `id-token: write`; `scripts/release.sh` packs with scripts disabled and publishes tarballs, which run none. Everywhere, dependency build scripts are opt-in through `allowBuilds` in `pnpm-workspace.yaml`. CI runs the workspace's own `prepare` (the `@effect/tsgo` patch the lint and type gates need) with read-only permissions.
- **Pinned actions, least privilege.** Every action is pinned to a full commit SHA; workflows default to `permissions: {}` and each job opts into only what it needs; CI checks out with `persist-credentials: false`.
- **Locked dependencies with a cooling-off period.** Installs use `--frozen-lockfile`; `minimumReleaseAge` holds a newly published third-party version for a day before pnpm installs it, and Dependabot proposes updates with the same cooldown. CI fails on any high or critical advisory (`pnpm audit --audit-level high`).
- **Exact ProseMirror pins.** `prosemirror-model` and `prosemirror-view` are pinned exactly under `overrides:`; Dependabot proposes them only for security advisories, and a bump is a person's decision.

## Invariant ids

Doc comments cite rules from the consuming applications' specs by id (`SEC-XSS-001`, `PERF-CPU-001`, `PERF-BUNDLE-001`). They point at the applications' evidence, not at anything defined in this repository.
