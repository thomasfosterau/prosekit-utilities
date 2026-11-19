# packages/prosekit-utilities — the core package

`@thomasfosterau/prosekit-utilities`: a ProseKit document grammar as data. Four entry points, built by `vp pack` (tsdown) into `dist/{index,derive,prosekit,drizzle}.js` + `.d.ts`, tested under node Vitest. Repo-wide conventions are in [docs/CONTRIBUTING.md](../../docs/CONTRIBUTING.md).

## Boundary

- **The root entry stays ProseKit-free.** Nothing under `src/*.ts` or `src/markdown/` may import `prosekit`, `@prosekit/pm` at the value level, or `src/prosekit/**` (`src/json.ts` keeps even the node types ProseKit-free). An app's browser-reachable model layer imports this entry only; only server code and editor routes import `./prosekit`. `./derive` and `./drizzle` are ProseKit-free too. [`scripts/check-dist-boundaries.ts`](../../scripts/check-dist-boundaries.ts) (`vp run check:dist`) enforces all three on the built `dist/`, failing closed on any import it cannot follow.
- **Generic over ProseKit, ignorant of any app.** Nothing here names a post body, an article section or any other app surface. An app-shaped special case is the signal that the code belongs in the app.

### Entry points

| Entry | Directory | Imports ProseKit at runtime | What it holds |
| --- | --- | --- | --- |
| `.` | `src/*.ts`, `src/markdown/` | **never** | `NodeJSON` types, `defineDocumentEnvelope`, allow-lists (`defineAllowList`, `checkAllowList`, `DocumentViolation`), `isSafeHref`, `extractDocumentText`, `inlineDocumentText`, `extractMentions`, `extractCitations`, the envelope helpers, the Markdown serialiser |
| `./derive` | `src/derive/` | never (types only) | the derivation engine: `Registry`, `deriveDocumentSchema`, the attribute overlay vocabulary |
| `./prosekit` | `src/prosekit/` | yes | node and mark definitions, the extension presets, `lazySchema`, `defineDocumentSchema`, `installDocumentGrammars`, `createHtmlRenderer` |
| `./drizzle` | `src/drizzle/` | never | `jsonbSchemaColumn`, `documentColumn`, `documentTextSql` |

Each entry has its own `index.ts` barrel; `tests/` mirrors `src/`.

## Invariants

- **Effect-first.** Domain failures are branded `Schema.TaggedError<Self, { readonly brand: unique symbol }>()(tag, fields)` classes (`DocumentViolation`, `DocumentDecodeError`, `HtmlRenderError`). Work that can fail returns `Effect`; optional values are `Option`, fallible pure computations `Result`; `null` only where ProseMirror's model demands it (a node attr). Pure total functions stay plain.
- **The derivation is the contract.** `./derive` reads node and mark names, groups, the content model and admissible marks off the compiled ProseMirror schema; `./prosekit`'s node and mark specs and `STANDARD_ATTRIBUTE_OVERRIDES` decide the rest. Stored documents are content-addressed and immutable in the consuming apps, so a change to any of these changes what already-stored rows decode as — a major changeset, every time. `prosemirror-model` / `prosemirror-view` are pinned exactly under `overrides:` in `pnpm-workspace.yaml` for the same reason, and the golden-fixture suite (`tests/prosekit/document-models.test.ts`) pins the wire shape of every node and mark.
- **The apps' own specs, not ProseKit's stock ones, for `highlight`, `subscript`, `superscript` and `mention`.** ProseKit ships same-named extensions (`defineHighlight`, `defineSubscript`, `defineSuperscript`, `defineMention`) with different attribute shapes; the ones here are wire-identical to documents the apps have already persisted, so never swap in ProseKit's.
- **Lazy, and cached per isolate.** Compiling a ProseMirror schema is expensive and the schema never changes at runtime. `lazySchema` compiles on first use and caches; `defineDocumentSchema` wraps the derivation in `Schema.suspend` so importing the module never pays for a compile; `createHtmlRenderer` resolves its DOM once. Never call `createEditor` on a per-row or per-render path.
- **Two halves, one envelope.** A `DocumentEnvelope` (root) and a `DocumentSchema` (`./prosekit`) are linked by the envelope object: `defineDocumentSchema(envelope, …)` and `schema.install()` upgrade that envelope's `Schema` from a structural check to the full grammar for the life of the isolate. The install site is the consuming app's persistence module, which every server runtime loads before handling a request and no browser bundle can reach. An uninstalled runtime is permissive, never spuriously rejecting.
- **Serialisers are total over the stock grammar.** `createMarkdownSerialiser`'s stock table and `createHtmlRenderer`'s sanitiser handle every node and mark the presets admit; an app node reaches Markdown through the `blocks` / `inlines` / `marks` option maps and HTML through ProseKit's own `toDOM` plus the `postProcess` hook. An unknown node in Markdown falls back to its inline text so nothing is silently lost.

## Terms

- **Document envelope** — a `DocumentEnvelope<Name>`: the persisted envelope `{ type: Name, content: NodeJSON[] }` checked structurally (`Schema.Array(Schema.Json)`, deliberately shallow — the measured rationale is in `document-envelope.ts`) plus a guard slot that `install` fills.
- **Document schema** — a `DocumentSchema<Name>`: the document envelope, an extension factory, the lazily compiled ProseMirror schema, and `Document`, the Effect Schema derived from it with the envelope's `type` literal in place of ProseMirror's `doc`.
- **Allow-list** — an `AllowList`: the node and mark type names one write surface admits (a comment, a post, a title), checked at the write seam by `checkAllowList` and reported as a `DocumentViolation`. Narrower than the grammar, never wider. `DocumentEnvelope.narrow(allowList)` composes the same check onto the envelope's codec for decode-time rejection.
- **Envelope** — the persisted top node type (`blockDocument`, `inlineDocument`, or whatever an app names it). ProseMirror's own top node is always `doc`; `toEditorDocument` / `fromEditorDocument` rename at the editor boundary.
- **Attribute overrides** — the record `attributeOverlay()` consumes: per node or mark, per attribute, the Effect Schema ProseMirror's `AttributeSpec` cannot express, optionally wrapped in `required(…)` for an attribute a live editor always serialises.
- **Registry cache** — the memo shared between two `defineDocumentSchema` calls that compose the same marks and `text` node, so the common structure derives once while each document schema stays independently lazy.
