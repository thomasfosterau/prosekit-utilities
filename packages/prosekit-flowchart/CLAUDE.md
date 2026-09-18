# packages/prosekit-flowchart — the flowchart block

`@thomasfosterau/prosekit-flowchart`: a flowchart block for ProseKit documents, in two entry points. `./node` is the canvas-free half — the ProseMirror node spec and its `updateFlowchartData` command, the Effect Schema payload, the server-renderable SVG, the attribute-override entry and the HTML / Markdown serialiser hooks — and imports neither Svelte nor xyflow, so it is safe on a server and in any bundle. The root is the `@xyflow/svelte` canvas (`Flowchart`), the edit dialog, the editable node, the ProseKit Svelte node view and the toolbar / insert-menu entries. Built with `svelte-package` exactly like the editor package; the repo-wide rules are in the root [AGENTS.md](../../AGENTS.md).

**Why it is its own package.** A component whose behaviour needs a specific third-party dependency lives in its own package adjacent to the editor package, so the editor package stays free of it. Here that dependency is `@xyflow/svelte` (and its stylesheet), which one of the two source apps deliberately dropped: it is this package's **required** peer, installing this package is the decision to render a flowchart, and `@thomasfosterau/prosekit-svelte` never mentions it.

## Layout

| Path | What it is |
| --- | --- |
| `src/lib/node/` | The `./node` entry: `schema.ts` (payload schemas), `data.ts` (`EMPTY_FLOWCHART`, `parseFlowchartData`), `svg.ts`, `flowchart-node.ts` (`defineFlowchart`), `overrides.ts`, `html.ts` (`postProcessFlowcharts`), `markdown.ts` (`flowchartMarkdown`). |
| `src/lib/*.svelte`, `src/lib/index.ts` | The root entry: `Flowchart`, `EditableNode`, `FlowchartEditDialog`, `FlowchartNodeView`, `defineFlowchartNodeView`, `flowchartToolbarItem`, `flowchartSlashCommand`. `Flowchart.svelte` carries the package's only side-effecting import, `@xyflow/svelte/dist/style.css`. |
| `src/stories/` | Stories, rendered by the ONE Storybook in `packages/prosekit-svelte` (its `stories` glob reaches across). There is no `.storybook/` here. |
| `tests/` | The browser suite: `tests/node/` for the `./node` entry (a mounted ProseMirror view is available because the suite runs in Chromium), one file per component for the root. |

## Import boundary

- **Siblings only through their published entry points.** `@thomasfosterau/prosekit-utilities` (root and `./derive`) and `@thomasfosterau/prosekit-svelte` are `workspace:*` dependencies resolved through their `exports`, i.e. their built `dist/` — never a relative path into another package's `src/`. That is why `check`, `build` and `test:unit` take `{ task: 'build', from: 'dependencies' }`.
- **`./node` imports no Svelte and no xyflow**, and the build proves it (`dist/node/*.js` contains neither specifier). It is the half a server render and a document-schema declaration need; the canvas is reached only from the root.
- **The engine is reached once, from one place.** `Flowchart.svelte` is the only module that imports `@xyflow/svelte` and its stylesheet; the node view previews a flowchart with the same SVG the server renders, so the xyflow bundle only loads when a user opens the edit dialog.

## Terms

- **Payload** — `FlowchartData = { nodes: FlowchartNode[], edges: FlowchartEdge[] }`, persisted as the `data` attribute of the `flowchart` node and serialised into the element's `data-payload` attribute with `<`, `>`, `&` and `'` unicode-escaped so a user label can never break out of the attribute. `parseFlowchartData` drops an individually malformed node or edge rather than the whole diagram, and yields an empty payload on total failure.
- **Post-process pass** — `postProcessFlowcharts(html, document)`: the `createHtmlRenderer` hook that replaces each `[data-flowchart]` element's inner HTML with the SVG while keeping `data-payload` for round-tripping.
- **Snapshot** — `Flowchart`'s `getSnapshot()`: the parent pulls the current diagram on save rather than receiving reactive change events, which keeps the data flow one-way and avoids a reactive bounce between the parent's draft and xyflow's internal mutations. `resetTo(payload)` is the other direction, called after the dialog opens so the canvas has a layout box for `fitView`.
- **Node copy** — `EditableNode`'s `nodeLabelLabel` / `untitledLabel` are the one exception to "every string is a prop": Svelte Flow instantiates a node component from the `nodeTypes` map, so they ride in the node's `data.labels`, and `Flowchart` (and through it `FlowchartEditDialog`) fills them from its own props.
- **Late engine load** — `FlowchartEditDialog` reaches `Flowchart.svelte` through a dynamic `import()`, so the xyflow bundle loads when a user opens the dialog, not when a document that merely contains a flowchart renders its node view.
