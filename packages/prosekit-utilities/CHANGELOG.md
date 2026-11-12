# @thomasfosterau/prosekit-utilities

## 0.2.0

### Minor Changes

- 06cbf7e: **Breaking:** `DocumentViolation`'s `name` field is renamed to `typeName`. It is the offending node or mark type (or `'link'` for a refused `href`). Under its old name it shadowed `Error.prototype.name`, so `String(violation)` and loggers printed `heading` instead of `DocumentViolation`. To migrate, read `violation.typeName` where you read `violation.name`.

  `DocumentViolation`, `DocumentDecodeError` and `HtmlRenderError` are now branded (`Schema.TaggedError<Self, { readonly brand: unique symbol }>()`). A plain object with the same fields no longer type-checks as one of these errors; construct them with `new` as before. Matching on `_tag` and `Effect.catchTag` are unchanged. Neither change touches the derivation or any node or mark spec.

- 20df3b2: **Breaking (types only):** the JSON shapes and the decode boundary name their value types.

  - `NodeJSON` / `MarkJSON` and the derived `DerivedNodeJSON` / `DerivedMarkJSON` now type `attrs` as `{ readonly [name: string]: Schema.Json }`, not `Record<string, unknown>`. A stored ProseMirror document's attributes are JSON values, and reading one still needs narrowing. A document built in code with a non-JSON attribute value (a `Date`, a function) no longer type-checks.
  - `DocumentSchema.decode` takes a `Schema.Json` (the parsed body of a `jsonb` column or `JSON.parse`) rather than `unknown`. `DocumentSchema.is` stays a guard over `unknown`, now spelled `Predicate.Refinement<unknown, DocumentJSON<Name>>`, and `DocumentGrammarGuard` is now `Predicate.Predicate<unknown>`. Both are the same function types as before.

  Nothing changes at runtime, and neither the derivation nor any node or mark spec changes.

- e603ece: **Breaking:** absence is now modelled with `Option`, and optional members drop `| undefined`.

  - `extractDocumentText`, `extractMentions` and `extractCitations` take the document itself (`NodeJSON | DocumentJSON`) instead of `… | null | undefined`. To read a nullable column, lift it at the read: `Option.fromNullishOr(row.body).pipe(Option.map(extractDocumentText))`. They still tolerate a missing `content` and malformed entries.
  - Options-object members are now `readonly x?: T`, not `readonly x?: T | undefined`. This covers `defineDocumentEnvelope`'s `label`, `defineAllowList`'s `checkLinkHref`, `isSafeHref`'s `schemes`, `extractDocumentText`'s `separator`, `createMarkdownSerialiser`'s `blocks` / `inlines` / `marks`, `DocumentSchemaOptions`, `HtmlRendererOptions`, and the flowchart's `FlowchartSvgLabels`. `NodeJSON` / `MarkJSON` use ProseMirror's own bare `?:`. Under `exactOptionalPropertyTypes`, a caller that passes an explicit `undefined` (`{ label: maybeLabel }`) must now spread the member in only when it is defined.

  Nothing changes at runtime, and neither the derivation nor any node or mark spec changes.

- 21da31e: The `prosekit` peer range is now `^0.23.0` (was `^0.22.2`), and the `@prosekit/pm` peer range is now `^0.1.21` (was `^0.1.19`), so prosekit 0.23 satisfies them. Every gate already ran against prosekit 0.23.0 / `@prosekit/pm` 0.1.21, so no code changes. 0.22.x is no longer admitted: a fresh install of it resolves two copies of `@prosekit/core`, which fails ProseKit's own assertion, so it can't be supported. Upgrade prosekit to 0.23 alongside this release.
- 7063e0f: Adds `extractMentions` and `extractCitations` to the root entry. They list the entities a stored document mentions (`{ id, label }`, from the `mention` node) and the works it cites (`workId`, from the `citation` mark), each id once, in document order. Both are pure, DOM-free and ProseKit-free, and tolerant of malformed rows in the same way as `extractDocumentText`. Neither changes the derivation or any node or mark spec.
- 175b783: `RegistryCache`'s `nodeCache` and `markCache` are now `effect/MutableHashMap`s instead of native `Map`s. Code that only passes a cache from `createRegistryCache()` to `Registry` or `defineDocumentSchema` is unaffected; code that reads the fields directly uses `MutableHashMap.get` / `has` / `size`. The derived schemas are unchanged.
- 3ba4763: Removes every type assertion from the package. Three changes are visible to consumers:

  - `NodeJSON`, `MarkJSON` and `DocumentJSON` are now type aliases rather than interfaces, so each is assignable to `Schema.Json`. Their members are unchanged.
  - `allowListViolation`, `checkAllowList` and `allowListFilter` accept any document whose `content` is a `ReadonlyArray<Schema.Json>`, which covers every `DocumentJSON`. That is what the walk always tolerated: a `null` entry or a node without a `type` is reported as a violation. Every document that type-checked before still does.
  - `deriveDocumentSchemas` returns `{ readonly [K in Extract<keyof Specs, string>]: Schema.Codec<DerivedNodeJSON> }`, which has the same keys for a literal specs object.

  **Behaviour:** `sanitiseDocument` (and so the HTML renderer) now drops a non-array `marks` or `content` from its copy instead of passing it through. Before, a malformed row like that made the render fail; now it renders without the malformed member.

- 36cdb15: **Breaking:** "shape" is renamed to "envelope" across the public API. The type that declares a document's persisted `{ type, content }` envelope is now `DocumentEnvelope`. Nothing changes at runtime, on the wire, in the derivation or in any node or mark spec: a stored `blockDocument` still decodes exactly as before.

  | Before | After |
  | --- | --- |
  | `DocumentShape<Name>` | `DocumentEnvelope<Name>` |
  | `DocumentShape.narrow(allowList)` | `DocumentEnvelope.narrow(allowList)` |
  | `defineDocumentShape({ name, label? })` | `defineDocumentEnvelope({ name, label? })` |
  | `DocumentSchema#shape` | `DocumentSchema#envelope` |
  | `defineDocumentSchema(shape, options)` | `defineDocumentSchema(envelope, options)` (positional) |

  Update imports from `@thomasfosterau/prosekit-utilities` and read `schema.envelope` where you read `schema.shape`.

### Patch Changes

- a40675f: The published package now includes its `CHANGELOG.md`, so the release notes can be read from `node_modules`. No code changes.

## 0.1.0

### Minor Changes

- 0493282: Built and tested against `effect@4.0.0-rc.118`; the `effect` peer range is `>=4.0.0-rc.118`. No public API changed.
- 5aa1d54: First release of the core package (`0.0.0` → `0.1.0`; the package has never been published): a ProseKit document grammar as data, extracted from the owner's two SvelteKit + Effect apps, in four entry points.

  - **`.`** (ProseKit-free): `defineDocumentShape` — the browser-cheap envelope codec with an installable grammar guard and `narrow(allowList)`; `defineAllowList`, `allowListViolation`, `checkAllowList` and `allowListFilter` with `DocumentViolation` as a tagged error; `isSafeHref`; `extractDocumentText` and `inlineDocumentText`; `toEditorDocument` / `fromEditorDocument`; `createMarkdownSerialiser` with the stock node table and opt-in `mentionMarkdown`, `figureMarkdown`, `sidenoteMarkdown` entries.
  - **`./derive`**: the effect-prosekit engine — `deriveDocumentSchema`, `deriveNodeSchema`, `deriveMarkSchema`, `Registry`, `createRegistryCache`, the attribute-overlay vocabulary — moved wholesale.
  - **`./prosekit`**: the stock node and mark re-exports, `defineInlineDoc`, the opt-in `defineMention`, `defineFigure`, `defineCitation`, `defineSidenote`, the individually exported `defineHighlight` / `defineSubscript` / `defineSuperscript`, `defineStandardMarks`, `defineEditorBehaviour`, `defineBlockDocumentExtension(...extra)` / `defineInlineDocumentExtension(...extra)`, `lazySchema`, `STANDARD_ATTRIBUTE_OVERRIDES` / `MENTION_ATTRIBUTE_OVERRIDES` / `mergeAttributeOverrides`, `defineDocumentSchema` (the `Schema.suspend`-wrapped derived document schema linked to a shape, with `is`, `decode` and `install`), `installDocumentGrammars`, and `createHtmlRenderer` (Effect and Promise APIs, sanitising, capability-detected DOM with linkedom on the server, a `postProcess` hook).
  - **`./drizzle`**: `jsonbSchemaColumn`, `documentColumn` and `documentTextSql`.

  Wire-compatible with the documents the apps have persisted: the node and mark specs, the attribute overrides and the derivation are the apps' own code, and the golden-fixture suites from both apps pass unchanged. The envelope is not versioned; a change to the derivation is a major release.

- 7a7ce2f: Build and test against `prosemirror-view` 1.42.3 (was 1.41.8), the first release that fixes GHSA-c8x8-7fp4-3x9w, an XSS in ProseMirror's paste handling. The package does not bundle or pin `prosemirror-view` (a consumer resolves it through `@prosekit/pm`), and the emitted `dist/` is unchanged; this is a major because the workspace's exact ProseMirror pins are part of the wire-compatibility contract. The golden wire-fixture suite passes unchanged. Consumers should resolve `prosemirror-view` >= 1.42.3 themselves.

### Patch Changes

- 80f4cdd: Documentation only: every Svelte component now carries a one-line `@component` doc that editors show on hover; `documentTextSql`, `documentColumn`, `FlowchartSvgLabels` and `parseFlowchartData` have hover summaries free of app-specific names; the package READMEs drop contributor-only sections and no longer overstate which components spread native attributes.
- 207f1ac: Tested against `effect@4.0.0`; peer floor unchanged (`>=4.0.0-rc.118`). No source change: the derived document schema encodes and decodes stored-document fixtures byte-identically to `4.0.0-rc.118`.
- 977fa55: The `effect` peer range is now `^4.0.0` (was `>=4.0.0-rc.118`), per the peer-range policy: no dependency needs more (`drizzle-orm`, the `./drizzle` entry's peer, accepts `effect >=4.0.0`), and the type gate, the core's suite, the browser suites, the build and `check:dist` pass against effect 4.0.0. Only the range's form changes: it no longer admits Effect 5 or the 4.0.0 release candidates. No code changes.
- 2da48c9: The module-load calls to `required(…)` in `STANDARD_ATTRIBUTE_OVERRIDES`, `MENTION_ATTRIBUTE_OVERRIDES` and `FLOWCHART_ATTRIBUTE_OVERRIDES`, and to `createMarkdownSerialiser()` behind `toMarkdown`, now carry a `/* @__PURE__ */` annotation in the published `dist/`. A consumer's bundler can now drop `toMarkdown`, `MENTION_ATTRIBUTE_OVERRIDES` and `FLOWCHART_ATTRIBUTE_OVERRIDES` when they're unused. `STANDARD_ATTRIBUTE_OVERRIDES` is still kept, because its arguments include un-annotated `Schema.*` calls. No behaviour change: the only difference in the emitted JavaScript is those comments.
- e13afc2: Every call to Effect's `Schema` / `Option` that runs when a module loads now carries a `/* @__PURE__ */` annotation in the published `dist/`, so a bundler that honours the annotation can drop what a consumer doesn't use. Measured with esbuild 0.28.2: `STANDARD_ATTRIBUTE_OVERRIDES` (with its `required(…)` calls) is no longer kept by a bundle that imports only `DocumentDecodeError` or `mergeAttributeOverrides` from `./prosekit`; `HtmlRenderError`, `DocumentDecodeError` and the root's `DocumentViolation` are dropped when unused; and `./drizzle`'s JSON text codec is dropped from a bundle that imports only `documentTextSql`. No behaviour change: in the emitted JavaScript the only differences are those comments, plus parentheses the bundler puts around the three error classes' annotated `extends` expressions. In the `.d.ts` files the same three `extends` clauses carry the comment, and a shared declaration chunk's hashed filename changes.
- fe2af1f: Fixes from type-aware linting, with no change in behaviour: optional parameters drop a redundant `| undefined` (`extractDocumentText`, `isSafeHref`, `createDefaultToolbarItems`, `createDefaultSlashCommands`), `ToolbarEditor` is written over `Editor` rather than `Editor<any>` (the same type), and the flowchart edit dialog loads its canvas through an async function.
