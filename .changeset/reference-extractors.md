---
'@thomasfosterau/prosekit-utilities': minor
---

Adds `extractMentions` and `extractCitations` to the root entry. They list the entities a stored document mentions (`{ id, label }`, from the `mention` node) and the works it cites (`workId`, from the `citation` mark), each id once, in document order. Both are pure, DOM-free and ProseKit-free, and tolerant of malformed rows in the same way as `extractDocumentText`. Neither changes the derivation or any node or mark spec.
