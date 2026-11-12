---
'@thomasfosterau/prosekit-utilities': minor
---

Removes every type assertion from the package. Three changes are visible to consumers:

- `NodeJSON`, `MarkJSON` and `DocumentJSON` are now type aliases rather than interfaces, so each is assignable to `Schema.Json`. Their members are unchanged.
- `allowListViolation`, `checkAllowList` and `allowListFilter` accept any document whose `content` is a `ReadonlyArray<Schema.Json>`, which covers every `DocumentJSON`. That is what the walk always tolerated: a `null` entry or a node without a `type` is reported as a violation. Every document that type-checked before still does.
- `deriveDocumentSchemas` returns `{ readonly [K in Extract<keyof Specs, string>]: Schema.Codec<DerivedNodeJSON> }`, which has the same keys for a literal specs object.

**Behaviour:** `sanitiseDocument` (and so the HTML renderer) now drops a non-array `marks` or `content` from its copy instead of passing it through. Before, a malformed row like that made the render fail; now it renders without the malformed member.
