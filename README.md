# prosekit-utilities

ProseKit document grammars as Effect Schemas, Drizzle document columns and Svelte 5 editor components, so a document type can be named, validated and stored without shipping the editor runtime to every page.

> [!CAUTION]
> Experimental and pre-1.0, largely written with Claude Code. The API may change between minor versions.

| Package | What it is |
| --- | --- |
| [`@thomasfosterau/prosekit-utilities`](packages/prosekit-utilities) | Document envelopes and allow-lists (`.`), an Effect Schema derived from a ProseMirror schema (`./derive`), ProseKit nodes, marks, presets and an HTML renderer (`./prosekit`), Drizzle `jsonb` columns (`./drizzle`) |
| [`@thomasfosterau/prosekit-svelte`](packages/prosekit-svelte) | Svelte 5 editor components on bits-ui: `Editor`, `BlockEditor`, `InlineEditor`, `BlockToolbar` |
| [`@thomasfosterau/prosekit-flowchart`](packages/prosekit-flowchart) | A flowchart block: node spec, payload schema and SVG under `./node`; the `@xyflow/svelte` canvas at the root |

## Install

```sh
pnpm add @thomasfosterau/prosekit-utilities effect prosekit @prosekit/pm
pnpm add @thomasfosterau/prosekit-svelte svelte              # editor components
pnpm add @thomasfosterau/prosekit-flowchart @xyflow/svelte   # flowchart block
```

Each package's README lists its peers per entry point.

## Usage

```ts
import { defineDocumentEnvelope } from '@thomasfosterau/prosekit-utilities';

// Imports no ProseKit, so it is safe in a browser bundle.
export const blockDocument = defineDocumentEnvelope({ name: 'blockDocument' });

blockDocument.is({ type: 'blockDocument', content: [] }); // true
```

On the server, `defineDocumentSchema` from `./prosekit` upgrades the same envelope to the full derived grammar.

## Documentation

- Guides in [`docs/`](docs): [document surfaces](docs/document-surfaces.md), [derivation](docs/derivation.md), [nodes and marks](docs/nodes-and-marks.md), [HTML and Markdown](docs/html-and-markdown.md), [Drizzle](docs/drizzle.md), [Svelte editor](docs/svelte-editor.md), [flowchart](docs/flowchart.md). The API reference is the TSDoc on each export.
- [Contributing](docs/CONTRIBUTING.md), [publishing](docs/PUBLISHING.md), [security](docs/SECURITY.md); agents also read [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE.md)
