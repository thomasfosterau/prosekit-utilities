/**
 * The ProseKit node-view extension for the `flowchart` block.
 *
 * Kept apart from `./node/flowchart-node.ts` — which registers the node spec
 * and the `updateFlowchartData` command — because the view pulls in Svelte, the
 * edit dialog and (through it) `@xyflow/svelte`, none of which may reach the
 * `./node` entry. A consuming app composes the two at editor-instantiation
 * time: `defineFlowchart()` for the schema, `defineFlowchartNodeView()` for the
 * UI.
 *
 * `defineSvelteNodeView` is a no-op on the server, so this is safe to include
 * in an extension that is also built server-side.
 *
 * @module @thomasfosterau/prosekit-flowchart/flowchart-node-view
 */

import { defineSvelteNodeView } from 'prosekit/svelte';
import FlowchartNodeView from './FlowchartNodeView.svelte';

/**
 * Registers {@link FlowchartNodeView} as the `flowchart` node's view, hosted in
 * a `div`.
 *
 * Both mutation guards return `true` on purpose: the rendered diagram rewrites
 * its own DOM (the SVG preview, and xyflow's canvas while the dialog is open),
 * and without them ProseMirror would read those rewrites as document edits and
 * fight the view for control of the node.
 */
export function defineFlowchartNodeView() {
  return defineSvelteNodeView({
    name: 'flowchart',
    component: FlowchartNodeView,
    as: 'div',
    ignoreMutation: () => true,
    stopEvent: () => true,
  });
}
