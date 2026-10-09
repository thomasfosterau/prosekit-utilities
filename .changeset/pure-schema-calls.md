---
'@thomasfosterau/prosekit-utilities': patch
---

Every call to Effect's `Schema` / `Option` that runs when a module loads now carries a `/* @__PURE__ */` annotation in the published `dist/`, so a bundler that honours the annotation can drop what a consumer doesn't use. Measured with esbuild 0.28.2: `STANDARD_ATTRIBUTE_OVERRIDES` (with its `required(…)` calls) is no longer kept by a bundle that imports only `DocumentDecodeError` or `mergeAttributeOverrides` from `./prosekit`; `HtmlRenderError`, `DocumentDecodeError` and the root's `DocumentViolation` are dropped when unused; and `./drizzle`'s JSON text codec is dropped from a bundle that imports only `documentTextSql`. No behaviour change: in the emitted JavaScript the only differences are those comments, plus parentheses the bundler puts around the three error classes' annotated `extends` expressions. In the `.d.ts` files the same three `extends` clauses carry the comment, and a shared declaration chunk's hashed filename changes.
