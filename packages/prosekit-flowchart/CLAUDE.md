# packages/prosekit-flowchart — the flowchart block

`@thomasfosterau/prosekit-flowchart`: a flowchart block for ProseKit documents, in two entry points. `./node` is the canvas-free half — the ProseMirror node spec and its `updateFlowchartData` command, the Effect Schema payload, the server-renderable SVG, the attribute-override entry and the HTML / Markdown serialiser hooks — and imports neither Svelte nor xyflow, so it is safe on a server and in any bundle. The root is the `@xyflow/svelte` canvas (`Flowchart`), the edit dialog, the editable node, the ProseKit Svelte node view and the toolbar / insert-menu entries. Built with `svelte-package` exactly like the editor package; the repo-wide rules are in the root [AGENTS.md](../../AGENTS.md).

## Boundary

- **Siblings only through their published entry points** — the repo-wide rule in the root AGENTS.md. This package imports `@thomasfosterau/prosekit-utilities` (root and `./derive`) and `@thomasfosterau/prosekit-svelte`.
- **`./node` (`src/lib/node/`) imports no Svelte and no xyflow.** It is the half a server render and a document-schema declaration need; the canvas is reached only from the root. Nothing enforces this yet (#25): after `vp run -r build`, `grep -lE "svelte|@xyflow" packages/prosekit-flowchart/dist/node/*.js` must print nothing.
- **The engine is reached once, from one place.** `Flowchart.svelte` is the only module that imports `@xyflow/svelte` and its stylesheet, `@xyflow/svelte/dist/style.css` — the package's only side-effecting import. The node view previews a flowchart with the same SVG the server renders, so the xyflow bundle only loads when a user opens the edit dialog.

## Invariants

- **`./node` follows the core's Effect house style** — `Schema.TaggedError` errors, `Option`/`Result`, plain functions for total computations; see [`packages/prosekit-utilities/CLAUDE.md` § Invariants](../prosekit-utilities/CLAUDE.md#invariants).
- **No Storybook here.** This package's stories (`src/stories/`) are rendered by the one Storybook in `packages/prosekit-svelte`, whose `stories` glob reaches across; there is no `.storybook/` in this package.
- **`tests/node/` runs in Chromium too**, so a mounted ProseMirror view is available to the `./node` tests.

## Terms

- **Payload** — `FlowchartData = { nodes: FlowchartNode[], edges: FlowchartEdge[] }`, persisted as the `data` attribute of the `flowchart` node and serialised into the element's `data-payload` attribute with `<`, `>`, `&` and `'` unicode-escaped so a user label can never break out of the attribute. `parseFlowchartData` drops an individually malformed node or edge rather than the whole diagram, and yields an empty payload on total failure.
- **Post-process pass** — `postProcessFlowcharts(html, document)`: the `createHtmlRenderer` hook that replaces each `[data-flowchart]` element's inner HTML with the SVG while keeping `data-payload` for round-tripping.
- **Snapshot** — `Flowchart`'s `getSnapshot()`: the parent pulls the current diagram on save rather than receiving reactive change events, which keeps the data flow one-way and avoids a reactive bounce between the parent's draft and xyflow's internal mutations. `resetTo(payload)` is the other direction, called after the dialog opens so the canvas has a layout box for `fitView`.
- **Node copy** — `EditableNode`'s `nodeLabelLabel` / `untitledLabel` are the one exception to "every string is a prop": Svelte Flow instantiates a node component from the `nodeTypes` map, so they ride in the node's `data.labels`, and `Flowchart` (and through it `FlowchartEditDialog`) fills them from its own props.
- **Late engine load** — `FlowchartEditDialog` reaches `Flowchart.svelte` through a dynamic `import()`, so the xyflow bundle loads when a user opens the dialog, not when a document that merely contains a flowchart renders its node view.
