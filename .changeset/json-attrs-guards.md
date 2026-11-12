---
'@thomasfosterau/prosekit-utilities': minor
---

**Breaking (types only):** the JSON shapes and the decode boundary name their value types.

- `NodeJSON` / `MarkJSON` and the derived `DerivedNodeJSON` / `DerivedMarkJSON` now type `attrs` as `{ readonly [name: string]: Schema.Json }`, not `Record<string, unknown>`. A stored ProseMirror document's attributes are JSON values, and reading one still needs narrowing. A document built in code with a non-JSON attribute value (a `Date`, a function) no longer type-checks.
- `DocumentSchema.decode` takes a `Schema.Json` (the parsed body of a `jsonb` column or `JSON.parse`) rather than `unknown`. `DocumentSchema.is` stays a guard over `unknown`, now spelled `Predicate.Refinement<unknown, DocumentJSON<Name>>`, and `DocumentGrammarGuard` is now `Predicate.Predicate<unknown>`. Both are the same function types as before.

Nothing changes at runtime, and neither the derivation nor any node or mark spec changes.
