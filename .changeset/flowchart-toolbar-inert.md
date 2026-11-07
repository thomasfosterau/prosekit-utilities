---
'@thomasfosterau/prosekit-flowchart': patch
---

`flowchartToolbarItem()` and `flowchartSlashCommand()` no longer throw when the editor's grammar has no `flowchart` node. ProseKit's `insertNode` throws `Cannot find ProseMirror node type "flowchart"` for a type the schema lacks, so the entries now check the schema first and only refocus the editor, as their documentation already said.
