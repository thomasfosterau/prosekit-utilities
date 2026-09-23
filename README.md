# prosekit-utilities

ProseKit document grammars as Effect Schemas, Drizzle document columns, and Svelte 5 editor components — in a [Vite+](https://viteplus.dev) workspace. Three publishable packages, consolidated out of the owner's SvelteKit + Effect apps.

| Package | Description |
| --- | --- |
| [`@thomasfosterau/prosekit-utilities`](./packages/prosekit-utilities) | The non-UI core: browser-cheap document shapes and allow-lists (`.`), an Effect Schema derived from a compiled ProseMirror schema (`./derive`), the ProseKit runtime, presets, derived document schema and HTML renderer (`./prosekit`), and Drizzle jsonb document columns (`./drizzle`) |
| [`@thomasfosterau/prosekit-svelte`](./packages/prosekit-svelte) | The Svelte 5 editor components: `Editor`, `BlockEditor`, `InlineEditor`, a declarative `BlockToolbar` with an insert menu and link/image dialogs on bits-ui |
| [`@thomasfosterau/prosekit-flowchart`](./packages/prosekit-flowchart) | A flowchart block — node spec, payload schema and server SVG under `./node`; the `@xyflow/svelte` canvas, edit dialog and node view at the root |

This is a publishable-library workspace, not an application: the build artifacts are `packages/*/dist`. Each package's `README.md` is its API reference; this file covers the workspace itself.

## Development

The toolchain is **Vite+** (the `vp` CLI) on **Node + pnpm**. Everything goes through `vp` rather than bare `pnpm`/`npm`.

```sh
pnpm install                                            # dependencies + the Vite+ git hooks
vp check                                                # format + lint (oxfmt + oxlint)
vp run check                                            # the type-check gate (tsc + svelte-check)
vp run -r test:unit                                     # node Vitest for the core, headless Chromium for the Svelte packages
vp run -r build                                         # vp pack / svelte-package -> packages/*/dist
vp run --filter ./packages/prosekit-svelte storybook    # the dev loop, port 6006 — one Storybook, both Svelte packages' stories
vp run --filter ./packages/prosekit-svelte storybook:build
```

`vp check`, `vp run check`, `vp run -r test:unit` and `vp run -r build` are the meaningful pre-push gates. There is no pre-push hook; the pre-commit hook runs `vp staged` (format + lint on staged files) only.

### Toolchain notes

- **Versions are catalogued.** Every external version lives in [`pnpm-workspace.yaml`](./pnpm-workspace.yaml) under `catalog:`; package.json files carry only `catalog:` or `workspace:*`, and `catalogMode: strict` enforces it. Edit the catalog, then `pnpm install`, then commit the regenerated `pnpm-lock.yaml`.
- **The Svelte suites drive a real browser.** Vitest browser mode over Playwright Chromium, headless everywhere. Locally that needs a Chromium matching the pinned `playwright` (`pnpm exec playwright install chromium`, or an image that pre-installs one under `PLAYWRIGHT_BROWSERS_PATH`); CI installs it in a step of its own.
- **`prosemirror-model` and `prosemirror-view` are pinned exactly.** The derivation reads ProseMirror's compiled schema; a stored document is only guaranteed to decode identically while that model is the same.
- **`.svelte` files are outside oxfmt's remit** and are kept in the same style by hand — two-space indent, single quotes. Everything else is formatted by `vp fmt`.

## Versioning

[Changesets](https://github.com/changesets/changesets). Add one per affected package with `pnpm changeset` in any pull request that changes published behaviour; the release workflow opens a version PR and, once it merges, publishes each package to npm with OIDC trusted publishing and provenance — there is no npm token in the repo.

## License

MIT © Thomas Foster
