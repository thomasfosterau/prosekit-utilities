---
'@thomasfosterau/prosekit-utilities': patch
'@thomasfosterau/prosekit-svelte': patch
'@thomasfosterau/prosekit-flowchart': patch
---

Fixes from type-aware linting, with no change in behaviour: optional parameters drop a redundant `| undefined` (`extractDocumentText`, `isSafeHref`, `createDefaultToolbarItems`, `createDefaultSlashCommands`), `ToolbarEditor` is written over `Editor` rather than `Editor<any>` (the same type), and the flowchart edit dialog loads its canvas through an async function.
