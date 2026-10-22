# prosekit-utilities

ProseKit document grammars as Effect Schemas, Drizzle document columns, and Svelte 5 editor components. Three npm packages, built so that a document type can be named, validated and stored without shipping the editor runtime to every page.

| Package | What it is |
| --- | --- |
| [`@thomasfosterau/prosekit-utilities`](./packages/prosekit-utilities) | The non-UI core: browser-cheap document shapes and allow-lists (`.`), an Effect Schema derived from a compiled ProseMirror schema (`./derive`), the ProseKit nodes, marks, presets, derived document schema and HTML renderer (`./prosekit`), and Drizzle `jsonb` document columns (`./drizzle`) |
| [`@thomasfosterau/prosekit-svelte`](./packages/prosekit-svelte) | Svelte 5 editor components on bits-ui: `Editor`, `BlockEditor`, `InlineEditor`, and a declarative `BlockToolbar` with an insert menu and link / image dialogs |
| [`@thomasfosterau/prosekit-flowchart`](./packages/prosekit-flowchart) | A flowchart block: the node spec, payload schema and server-rendered SVG under `./node`; the `@xyflow/svelte` canvas, edit dialog and node view at the root |

Each package's `README.md` is its full API reference.

## Install

```sh
pnpm add @thomasfosterau/prosekit-utilities effect prosekit @prosekit/pm
pnpm add @thomasfosterau/prosekit-svelte svelte              # the editor components
pnpm add @thomasfosterau/prosekit-flowchart @xyflow/svelte   # the flowchart block
```

The peer ranges, and which entry point needs which peer, are in each package's README.

## A minimal example

Declare a document shape where the browser can reach it — this imports no ProseKit — then validate stored values against it:

```ts
import { defineDocumentShape } from '@thomasfosterau/prosekit-utilities';

export const blockDocument = defineDocumentShape({ name: 'blockDocument' });

blockDocument.is({ type: 'blockDocument', content: [] }); // true
blockDocument.is({ type: 'paragraph' }); // false
blockDocument.Schema; // the Effect Schema codec, for decoding at a persistence seam
```

On the server, `defineDocumentSchema` from `./prosekit` upgrades that same shape to the full grammar derived from ProseKit's compiled schema; [the core README](./packages/prosekit-utilities/README.md#declaring-a-document-surface) walks through every layer.

## Links

- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, hooks and individual checks
- [AGENTS.md](AGENTS.md) — the conventions and the verification gates, for humans and agents alike
- [PUBLISHING.md](PUBLISHING.md) — the release pipeline and its one-time owner setup
- [SECURITY.md](SECURITY.md) — reporting a vulnerability, supply-chain posture

## License

MIT © Thomas Foster
