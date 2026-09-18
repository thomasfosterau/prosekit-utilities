---
'@thomasfosterau/prosekit-utilities': minor
---

First release of the core package: a ProseKit document grammar as data, extracted from the owner's two SvelteKit + Effect apps, in four entry points.

- **`.`** (ProseKit-free): `defineDocumentShape` — the browser-cheap envelope codec with an installable grammar guard and `narrow(allowList)`; `defineAllowList`, `allowListViolation`, `checkAllowList` and `allowListFilter` with `DocumentViolation` as a tagged error; `isSafeHref`; `extractDocumentText` and `inlineDocumentText`; `toEditorDocument` / `fromEditorDocument`; `createMarkdownSerialiser` with the stock node table and opt-in `mentionMarkdown`, `figureMarkdown`, `sidenoteMarkdown` entries.
- **`./derive`**: the effect-prosekit engine — `deriveDocumentSchema`, `deriveNodeSchema`, `deriveMarkSchema`, `Registry`, `createRegistryCache`, the attribute-overlay vocabulary — moved wholesale.
- **`./prosekit`**: the stock node and mark re-exports, `defineInlineDoc`, the opt-in `defineMention`, `defineFigure`, `defineCitation`, `defineSidenote`, the individually exported `defineHighlight` / `defineSubscript` / `defineSuperscript`, `defineStandardMarks`, `defineEditorBehaviour`, `defineBlockDocumentExtension(...extra)` / `defineInlineDocumentExtension(...extra)`, `lazySchema`, `STANDARD_ATTRIBUTE_OVERRIDES` / `MENTION_ATTRIBUTE_OVERRIDES` / `mergeAttributeOverrides`, `defineDocumentSchema` (the `Schema.suspend`-wrapped derived document schema linked to a shape, with `is`, `decode` and `install`), `installDocumentGrammars`, and `createHtmlRenderer` (Effect and Promise APIs, sanitising, capability-detected DOM with linkedom on the server, a `postProcess` hook).
- **`./drizzle`**: `jsonbSchemaColumn`, `documentColumn` and `documentTextSql`.

Wire-compatible with the documents the apps have persisted: the node and mark specs, the attribute overrides and the derivation are the apps' own code, and the golden-fixture suites from both apps pass unchanged. The envelope is not versioned; a change to the derivation is a major release.
