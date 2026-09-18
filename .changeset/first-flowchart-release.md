---
'@thomasfosterau/prosekit-flowchart': minor
---

First release of the flowchart block, split into its own package because it needs `@xyflow/svelte` (a required peer) that the editor package must stay free of.

- **`./node`** (no Svelte, no xyflow): the `FlowchartData` / `FlowchartNode` / `FlowchartEdge` schemas, `EMPTY_FLOWCHART`, `parseFlowchartData`, `generateFlowchartSvg` (server-renderable, labels as options), `defineFlowchart` (node spec + `updateFlowchartData`), `FLOWCHART_ATTRIBUTE_OVERRIDES`, `postProcessFlowcharts` (the `createHtmlRenderer` hook) and `flowchartMarkdown`.
- **root**: `Flowchart` (the xyflow canvas; `resetTo`, `getSnapshot`, `addNode`), `EditableNode`, `FlowchartEditDialog` (bits-ui `Dialog`, every string a prop), `FlowchartNodeView` + `defineFlowchartNodeView()`, `flowchartToolbarItem()` and `flowchartSlashCommand()` for `@thomasfosterau/prosekit-svelte`'s toolbar.
