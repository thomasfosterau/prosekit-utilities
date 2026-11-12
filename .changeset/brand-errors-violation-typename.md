---
'@thomasfosterau/prosekit-utilities': minor
---

**Breaking:** `DocumentViolation`'s `name` field is renamed to `typeName`. It is the offending node or mark type (or `'link'` for a refused `href`). Under its old name it shadowed `Error.prototype.name`, so `String(violation)` and loggers printed `heading` instead of `DocumentViolation`. To migrate, read `violation.typeName` where you read `violation.name`.

`DocumentViolation`, `DocumentDecodeError` and `HtmlRenderError` are now branded (`Schema.TaggedError<Self, { readonly brand: unique symbol }>()`). A plain object with the same fields no longer type-checks as one of these errors; construct them with `new` as before. Matching on `_tag` and `Effect.catchTag` are unchanged. Neither change touches the derivation or any node or mark spec.
