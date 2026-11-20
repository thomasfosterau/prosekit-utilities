# Publishing

Releases use [Changesets](https://github.com/changesets/changesets) and npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC): there is no `NPM_TOKEN`.

## Flow

1. Add a changeset with your change ([CONTRIBUTING.md](CONTRIBUTING.md#changesets)).
2. On merge to `trunk`, the Release workflow opens or updates the **"chore: version packages"** PR and assigns it to the owner. Its version step is `changeset version && vp fmt`.
3. That PR's head is pushed with `GITHUB_TOKEN`, which starts no workflow: run **CI** on `changeset-release/trunk` from the Actions tab before merging it.
4. Once it merges, the `publish` job (protected `release` environment) runs `vp run release`, a `vite.config.ts` task (there is no publish script): every build, `vp run check:dist`, then `vp pm publish -r --access public --no-git-checks -- --ignore-scripts`, which publishes each package whose version isn't on npm yet, in dependency order, and skips the rest; then `changeset git-tag`, which tags each new version and reports the tags to the Changesets action, which pushes them and creates the GitHub releases. A failed publish stops before tagging, and a re-run publishes only what is missing. Nothing in the release path calls the npm CLI.

`vp run release:dry-run` builds, checks and lists what would be published, without publishing or tagging.

pnpm attaches provenance itself once the repository and package are public. Never pass `--provenance`: from a private repository it fails the publish.

## One-time owner setup

1. Settings → Actions → General: allow GitHub Actions to create and approve pull requests.
2. A trusted publisher needs an existing package, so publish a new package's first version by hand from a clean `trunk`: `vp install --frozen-lockfile`, `vp run release:dry-run`, then `vp run release`, then `git push origin --tags`.
3. On npmjs.com, for each package: Trusted Publisher → GitHub Actions, repository `thomasfosterau/prosekit-utilities`, workflow `release.yml`, environment `release`.
4. Settings → Environments → `release`: required reviewers, deployments from `trunk` only.
5. Protect `trunk`: require PRs and the `ci (node lts)` / `ci (node latest)` checks; squash merging only.
