# @thomasfosterau/prosekit-utilities

## 1.0.0

### Major Changes

- 7a7ce2f: Build and test against `prosemirror-view` 1.42.3 (was 1.41.8), the first release that fixes GHSA-c8x8-7fp4-3x9w, an XSS in ProseMirror's paste handling. The package does not bundle or pin `prosemirror-view` (a consumer resolves it through `@prosekit/pm`), and the emitted `dist/` is unchanged; this is a major because the workspace's exact ProseMirror pins are part of the wire-compatibility contract. The golden wire-fixture suite passes unchanged. Consumers should resolve `prosemirror-view` >= 1.42.3 themselves.

### Minor Changes

- 0493282: Built and tested against `effect@4.0.0-rc.118`; the `effect` peer range is `>=4.0.0-rc.118`. No public API changed.
- 5aa1d54: First release of the core package (`0.0.0` → `0.1.0`; the package has never been published): a ProseKit document grammar as data, extracted from the owner's two SvelteKit + Effect apps, in four entry points.

  - **`.`** (ProseKit-free): `defineDocumentShape` — the browser-cheap envelope codec with an installable grammar guard and `narrow(allowList)`; `defineAllowList`, `allowListViolation`, `checkAllowList` and `allowListFilter` with `DocumentViolation` as a tagged error; `isSafeHref`; `extractDocumentText` and `inlineDocumentText`; `toEditorDocument` / `fromEditorDocument`; `createMarkdownSerialiser` with the stock node table and opt-in `mentionMarkdown`, `figureMarkdown`, `sidenoteMarkdown` entries.
  - **`./derive`**: the effect-prosekit engine — `deriveDocumentSchema`, `deriveNodeSchema`, `deriveMarkSchema`, `Registry`, `createRegistryCache`, the attribute-overlay vocabulary — moved wholesale.
  - **`./prosekit`**: the stock node and mark re-exports, `defineInlineDoc`, the opt-in `defineMention`, `defineFigure`, `defineCitation`, `defineSidenote`, the individually exported `defineHighlight` / `defineSubscript` / `defineSuperscript`, `defineStandardMarks`, `defineEditorBehaviour`, `defineBlockDocumentExtension(...extra)` / `defineInlineDocumentExtension(...extra)`, `lazySchema`, `STANDARD_ATTRIBUTE_OVERRIDES` / `MENTION_ATTRIBUTE_OVERRIDES` / `mergeAttributeOverrides`, `defineDocumentSchema` (the `Schema.suspend`-wrapped derived document schema linked to a shape, with `is`, `decode` and `install`), `installDocumentGrammars`, and `createHtmlRenderer` (Effect and Promise APIs, sanitising, capability-detected DOM with linkedom on the server, a `postProcess` hook).
  - **`./drizzle`**: `jsonbSchemaColumn`, `documentColumn` and `documentTextSql`.

  Wire-compatible with the documents the apps have persisted: the node and mark specs, the attribute overrides and the derivation are the apps' own code, and the golden-fixture suites from both apps pass unchanged. The envelope is not versioned; a change to the derivation is a major release.

### Patch Changes

- 80f4cdd: Documentation only: every Svelte component now carries a one-line `@component` doc that editors show on hover; `documentTextSql`, `documentColumn`, `FlowchartSvgLabels` and `parseFlowchartData` have hover summaries free of app-specific names; the package READMEs drop contributor-only sections and no longer overstate which components spread native attributes.
- 207f1ac: Tested against `effect@4.0.0`; peer floor unchanged (`>=4.0.0-rc.118`). No source change: the derived document schema encodes and decodes stored-document fixtures byte-identically to `4.0.0-rc.118`.
- 2da48c9: The module-load calls to `required(…)` in `STANDARD_ATTRIBUTE_OVERRIDES`, `MENTION_ATTRIBUTE_OVERRIDES` and `FLOWCHART_ATTRIBUTE_OVERRIDES`, and to `createMarkdownSerialiser()` behind `toMarkdown`, now carry a `/* @__PURE__ */` annotation in the published `dist/`. A consumer's bundler can now drop `toMarkdown`, `MENTION_ATTRIBUTE_OVERRIDES` and `FLOWCHART_ATTRIBUTE_OVERRIDES` when they're unused. `STANDARD_ATTRIBUTE_OVERRIDES` is still kept, because its arguments include un-annotated `Schema.*` calls. No behaviour change: the only difference in the emitted JavaScript is those comments.
- e13afc2: Every call to Effect's `Schema` / `Option` that runs when a module loads now carries a `/* @__PURE__ */` annotation in the published `dist/`, so a bundler that honours the annotation can drop what a consumer doesn't use. Measured with esbuild 0.28.2: `STANDARD_ATTRIBUTE_OVERRIDES` (with its `required(…)` calls) is no longer kept by a bundle that imports only `DocumentDecodeError` or `mergeAttributeOverrides` from `./prosekit`; `HtmlRenderError`, `DocumentDecodeError` and the root's `DocumentViolation` are dropped when unused; and `./drizzle`'s JSON text codec is dropped from a bundle that imports only `documentTextSql`. No behaviour change: in the emitted JavaScript the only differences are those comments, plus parentheses the bundler puts around the three error classes' annotated `extends` expressions. In the `.d.ts` files the same three `extends` clauses carry the comment, and a shared declaration chunk's hashed filename changes.
- fe2af1f: Fixes from type-aware linting, with no change in behaviour: optional parameters drop a redundant `| undefined` (`extractDocumentText`, `isSafeHref`, `createDefaultToolbarItems`, `createDefaultSlashCommands`), `ToolbarEditor` is written over `Editor` rather than `Editor<any>` (the same type), and the flowchart edit dialog loads its canvas through an async function.
