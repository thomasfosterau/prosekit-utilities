---
'@thomasfosterau/prosekit-utilities': minor
---

**Breaking:** "shape" is renamed to "envelope" across the public API. The type that declares a document's persisted `{ type, content }` envelope is now `DocumentEnvelope`. Nothing changes at runtime, on the wire, in the derivation or in any node or mark spec: a stored `blockDocument` still decodes exactly as before.

| Before                                  | After                                                  |
| --------------------------------------- | ------------------------------------------------------ |
| `DocumentShape<Name>`                   | `DocumentEnvelope<Name>`                               |
| `DocumentShape.narrow(allowList)`       | `DocumentEnvelope.narrow(allowList)`                   |
| `defineDocumentShape({ name, label? })` | `defineDocumentEnvelope({ name, label? })`             |
| `DocumentSchema#shape`                  | `DocumentSchema#envelope`                              |
| `defineDocumentSchema(shape, options)`  | `defineDocumentSchema(envelope, options)` (positional) |

Update imports from `@thomasfosterau/prosekit-utilities` and read `schema.envelope` where you read `schema.shape`.
