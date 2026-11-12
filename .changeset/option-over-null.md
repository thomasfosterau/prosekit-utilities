---
'@thomasfosterau/prosekit-utilities': minor
'@thomasfosterau/prosekit-flowchart': minor
---

**Breaking:** absence is now modelled with `Option`, and optional members drop `| undefined`.

- `extractDocumentText`, `extractMentions` and `extractCitations` take the document itself (`NodeJSON | DocumentJSON`) instead of `… | null | undefined`. To read a nullable column, lift it at the read: `Option.fromNullishOr(row.body).pipe(Option.map(extractDocumentText))`. They still tolerate a missing `content` and malformed entries.
- Options-object members are now `readonly x?: T`, not `readonly x?: T | undefined`. This covers `defineDocumentEnvelope`'s `label`, `defineAllowList`'s `checkLinkHref`, `isSafeHref`'s `schemes`, `extractDocumentText`'s `separator`, `createMarkdownSerialiser`'s `blocks` / `inlines` / `marks`, `DocumentSchemaOptions`, `HtmlRendererOptions`, and the flowchart's `FlowchartSvgLabels`. `NodeJSON` / `MarkJSON` use ProseMirror's own bare `?:`. Under `exactOptionalPropertyTypes`, a caller that passes an explicit `undefined` (`{ label: maybeLabel }`) must now spread the member in only when it is defined.

Nothing changes at runtime, and neither the derivation nor any node or mark spec changes.
