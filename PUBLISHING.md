# Publishing & releases

Releases are automated with [Changesets](https://github.com/changesets/changesets) and published to npm with [OIDC trusted publishing](https://docs.npmjs.com/trusted-publishers): there is no `NPM_TOKEN`. The security rationale is in [SECURITY.md](SECURITY.md#supply-chain-hardening); the reason for each pipeline step is in the comments of [`.github/workflows/release.yml`](.github/workflows/release.yml) and [`scripts/release.sh`](scripts/release.sh).

## The release flow

1. **Add a changeset with your change.** `pnpm changeset`, pick the packages and the bump, write a user-facing summary, commit the generated file. Which changes need one, and which are a **major**, is in [AGENTS.md § Branches and pull requests](AGENTS.md#branches-and-pull-requests).
2. **Merge to `trunk`.** The Release workflow runs and, while changesets are pending, opens or updates the **"chore: version packages"** PR. Its version step is `changeset version && vp fmt`, with `"format": false` in `.changeset/config.json` so Changesets does not invoke Vite+'s IDE-only `oxfmt` shim; `vp fmt` formats the changelogs instead.
3. **Merge the version PR.** With no changesets left, the workflow builds every package and runs `pnpm run release` ([`scripts/release.sh`](scripts/release.sh)): it skips any package already on npm at its version, packs the rest with `pnpm pack` (rewriting `workspace:*` and `catalog:` to real ranges), publishes each tarball with `npm publish` (npm's own trusted publishing, on the npm version the job pins), and runs `changeset tag`, whose `New tag:` lines the Changesets action turns into tags and GitHub releases.

Provenance is left to npm: it is attached only once the repository and the package are both public. Never add `--provenance` or `NPM_CONFIG_PROVENANCE=true`; from a private repository either fails the publish.

## Maintainer setup (one-time)

None of this can be done by an agent.

1. **Allow Actions to open the version PR.** Settings → Actions → General → Workflow permissions → enable "Allow GitHub Actions to create and approve pull requests", or the built-in `GITHUB_TOKEN` cannot open it.
2. **Configure the trusted publisher** for each of the three packages on npmjs.com → Settings → Trusted Publisher → GitHub Actions: repository `thomasfosterau/prosekit-utilities`, workflow `release.yml`, environment `release`. If npm still requires a package to exist first, bootstrap it by hand once (`vp run -r build`, then `pnpm pack` and `npm publish <tarball> --access public` from that package), after which the script skips that version.
3. **Protect the `release` environment.** Settings → Environments → `release` → required reviewers, deployments restricted to `trunk`.
4. **Protect `trunk`.** Require pull requests and the passing `CI` check, and allow squash merging only (#30).

The open `changeset-release/main` PR (#17) predates the move of the workflows to `trunk`: close it once the workflow has opened its `changeset-release/trunk` successor.
