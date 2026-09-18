# packages/prosekit-utilities — the core package

`@thomasfosterau/prosekit-utilities`: a ProseKit document grammar as data. Four entry points, built by `vp pack` (tsdown) into `dist/{index,derive,prosekit,drizzle}.js` + `.d.ts`, tested under node Vitest. The repo-wide rules (Effect-first, `.ts` imports, `T | undefined`, `vite-plus/test`) live in the root [AGENTS.md](../../AGENTS.md); this file carries what is specific to the package.

## Layout and entry points

| Entry | Directory | Imports ProseKit at runtime | What it holds |
| --- | --- | --- | --- |
| `.` | `src/*.ts`, `src/markdown/` | **never** | `NodeJSON` types, `defineDocumentShape`, allow-lists (`defineAllowList`, `checkAllowList`, `DocumentViolation`), `isSafeHref`, `extractDocumentText`, `inlineDocumentText`, the envelope helpers, the Markdown serialiser |
| `./derive` | `src/derive/` | never (types only) | the derivation engine: `Registry`, `deriveDocumentSchema`, the attribute overlay vocabulary |
| `./prosekit` | `src/prosekit/` | yes | node and mark definitions, the extension presets, `lazySchema`, `defineDocumentSchema`, `installDocumentGrammars`, `createHtmlRenderer` |
| `./drizzle` | `src/drizzle/` | never | `jsonbSchemaColumn`, `documentColumn`, `documentTextSql` |

Each entry has its own `index.ts` barrel; `tests/` mirrors `src/`.

## Local invariants

- **The root entry stays ProseKit-free.** Nothing under `src/*.ts` or `src/markdown/` may import `prosekit`, `@prosekit/pm` at the value level, or `src/prosekit/**`. `src/json.ts` exists so the root's node types need no ProseKit type import either. The build proves it: `dist/index.js` must contain no `prosekit` specifier. A consuming app's browser-reachable model layer imports this entry only, which is what keeps the editor runtime off every page without a document field.
- **The derivation is the contract.** `./derive` reads node and mark names, groups, the content model and admissible marks off the compiled ProseMirror schema; `./prosekit`'s node and mark specs and `STANDARD_ATTRIBUTE_OVERRIDES` decide the rest. Stored documents are content-addressed and immutable in the consuming apps, so a change to any of these changes what already-stored rows decode as — a major changeset, every time. `prosemirror-model` / `prosemirror-view` are pinned exactly in the catalog for the same reason, and the golden-fixture suite (`tests/prosekit/document-models.test.ts`) pins the wire shape of every node and mark.
- **The apps' own specs, not ProseKit's stock ones, for `highlight`, `subscript`, `superscript` and `mention`.** ProseKit ships same-named extensions with different attribute shapes; the ones here are wire-identical to documents the apps have already persisted.
- **Lazy, and cached per isolate.** Compiling a ProseMirror schema is expensive and the schema never changes at runtime. `lazySchema` compiles on first use and caches; `defineDocumentSchema` wraps the derivation in `Schema.suspend` so importing the module never pays for a compile; `createHtmlRenderer` resolves its DOM once. Never call `createEditor` on a per-row or per-render path.
- **Two halves, one shape.** A `DocumentShape` (root) and a `DocumentSchema` (`./prosekit`) are linked by the shape object: `defineDocumentSchema(shape, …)` and `schema.install()` upgrade that shape's `Schema` from a structural check to the full grammar for the life of the isolate. The install site is the consuming app's persistence module, which every server runtime loads before handling a request and no browser bundle can reach. An uninstalled runtime is permissive, never spuriously rejecting.
- **Serialisers are total over the stock grammar.** `createMarkdownSerialiser`'s stock table and `createHtmlRenderer`'s sanitiser handle every node and mark the presets admit; an app node reaches Markdown through the `blocks` / `inlines` / `marks` option maps and HTML through ProseKit's own `toDOM` plus the `postProcess` hook. An unknown node in Markdown falls back to its inline text so nothing is silently lost.

## Terms

- **Shape** — a `DocumentShape<Name>`: the envelope `{ type: Name, content: NodeJSON[] }` checked structurally (`Schema.Array(Schema.Json)`, deliberately shallow — the measured rationale is in `document-shape.ts`) plus a guard slot that `install` fills.
- **Document schema** — a `DocumentSchema<Name>`: the shape, an extension factory, the lazily compiled ProseMirror schema, and `Document`, the Effect Schema derived from it with the envelope's `type` literal in place of ProseMirror's `doc`.
- **Allow-list** — an `AllowList`: the node and mark type names one write surface admits (a comment, a post, a title), checked at the write seam by `checkAllowList` and reported as a `DocumentViolation`. Narrower than the grammar, never wider. `DocumentShape.narrow(allowList)` composes the same check onto the shape's codec for decode-time rejection.
- **Envelope** — the persisted top node type (`blockDocument`, `inlineDocument`, or whatever an app names it). ProseMirror's own top node is always `doc`; `toEditorDocument` / `fromEditorDocument` rename at the editor boundary.
- **Attribute overrides** — the record `attributeOverlay()` consumes: per node or mark, per attribute, the Effect Schema ProseMirror's `AttributeSpec` cannot express, optionally wrapped in `required(…)` for an attribute a live editor always serialises.
- **Registry cache** — the memo shared between two `defineDocumentSchema` calls that compose the same marks and `text` node, so the common structure derives once while each document schema stays independently lazy.
