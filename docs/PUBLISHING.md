# Publishing

Releases use [Changesets](https://github.com/changesets/changesets) and npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC): there is no `NPM_TOKEN`.

## Flow

1. Add a changeset with your change ([CONTRIBUTING.md](CONTRIBUTING.md#changesets)).
2. On merge to `trunk`, the Release workflow opens or updates the **"chore: version packages"** PR and assigns it to the owner. Its version step is `changeset version && vp fmt`.
3. That PR's head is pushed with `GITHUB_TOKEN`, which starts no workflow: run **CI** on `changeset-release/trunk` from the Actions tab before merging it.
4. Once it merges, the `publish` job (protected `release` environment) builds and runs [`scripts/release.sh`](../scripts/release.sh): it packs every package not yet on npm at its version, publishes each tarball with `npm publish`, and runs `changeset tag`.

npm attaches provenance itself once the repository and package are public. Never pass `--provenance`: from a private repository it fails the publish.

## One-time owner setup

1. Settings → Actions → General: allow GitHub Actions to create and approve pull requests.
2. On npmjs.com, for each package: Trusted Publisher → GitHub Actions, repository `thomasfosterau/prosekit-utilities`, workflow `release.yml`, environment `release`.
3. Settings → Environments → `release`: required reviewers, deployments from `trunk` only.
4. Protect `trunk`: require PRs and the `ci (node lts)` / `ci (node latest)` checks; squash merging only.
