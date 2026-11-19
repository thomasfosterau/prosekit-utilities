# Security

## Reporting a vulnerability

Report privately through GitHub's [**Report a vulnerability**](https://github.com/thomasfosterau/prosekit-utilities/security/advisories/new), not a public issue. Include the affected package and version and reproduction steps.

These packages render and sanitise user-authored documents, so the most valuable reports get markup or a `javascript:` URL past `createHtmlRenderer`'s sanitiser or `isSafeHref`, out of the flowchart's `data-payload` attribute, or past an allow-list check.

## Supply chain

- No long-lived npm token: releases use OIDC trusted publishing from a protected environment ([PUBLISHING.md](PUBLISHING.md)).
- Release jobs install with `--ignore-scripts` and disable pnpm's `verify-deps-before-run`, so no dependency script runs where `id-token: write` is held. Dependency build scripts are opt-in through `allowBuilds`.
- Workflows default to `permissions: {}`, pin actions by exact tag locked to commits (`actions.lock`), and check out without persisted credentials. CI holds no secrets.
- `minimumReleaseAge` holds new releases for 8 hours; Dependabot waits a day. CI fails on high or critical advisories.
- `prosemirror-model` / `prosemirror-view` are pinned exactly.
