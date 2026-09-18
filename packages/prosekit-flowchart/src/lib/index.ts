/**
 * `@thomasfosterau/prosekit-flowchart` — the flowchart canvas, edit dialog
 * and ProseKit node view on `@xyflow/svelte`.
 *
 * `Flowchart.svelte` carries this package's only side-effecting import,
 * `@xyflow/svelte/dist/style.css`. The ProseKit node spec, its Effect Schema
 * payload and the server SVG renderer live under `./node`, which imports
 * neither Svelte nor xyflow and is a separate entry point — nothing from it is
 * re-exported here, so a server bundle never reaches this module.
 *
 * @module
 */

export { default as EditableNode } from './EditableNode.svelte';
export { default as Flowchart } from './Flowchart.svelte';
export { defineFlowchartNodeView } from './flowchart-node-view.ts';
export { default as FlowchartEditDialog } from './FlowchartEditDialog.svelte';
export { default as FlowchartNodeView } from './FlowchartNodeView.svelte';
export { flowchartSlashCommand, flowchartToolbarItem } from './toolbar.ts';
