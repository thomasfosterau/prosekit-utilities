/**
 * The flowchart's toolbar and insert-menu entries, to append to the editor's
 * default sets.
 */

import type { SlashCommand, ToolbarItem, ToolbarRunContext } from '@thomasfosterau/prosekit-svelte';
import type { FlowchartData } from './node/schema.ts';

/**
 * The diagram a freshly inserted flowchart block carries.
 *
 * Built per call, never shared: the payload becomes a ProseMirror node
 * attribute, and handing two nodes the same object would let an edit to one
 * diagram appear in the other.
 */
function starterDiagram(): FlowchartData {
  return {
    nodes: [{ id: 'n-start', position: { x: 120, y: 80 }, data: { label: 'Start' } }],
    edges: [],
  };
}

/**
 * Inserts a `flowchart` node at the selection, then returns focus to the
 * document.
 *
 * The command is reached by name through the editor's own `commands` record —
 * the same loose lookup the default item set uses — and only when the schema
 * has a `flowchart` node, so the entry is inert rather than throwing against
 * an extension that never registered `defineFlowchart()`.
 */
function insertFlowchart({ editor }: ToolbarRunContext): void {
  // ProseKit's `insertNode` throws on a node type the schema lacks, so the
  // schema is checked first. `ToolbarEditor.commands` is an open record, so an
  // absent command reads as `undefined` rather than a type error.
  if (editor.schema.nodes['flowchart'] !== undefined) {
    editor.commands['insertNode']?.({ type: 'flowchart', attrs: { data: starterDiagram() } });
  }
  editor.focus();
}

/**
 * The toolbar button that inserts a flowchart block.
 *
 * An action, not a toggle: inserting a block has no pressed state, and a
 * button claiming one would lie to every assistive technology reading it.
 *
 * @param label - Visible text and accessible name. Default: `'Flowchart'`.
 */
export function flowchartToolbarItem(label: string = 'Flowchart'): ToolbarItem {
  return {
    id: 'flowchart',
    label,
    kind: 'action',
    run: insertFlowchart,
  };
}

/**
 * The insert-menu entry that inserts a flowchart block — the same insertion as
 * {@link flowchartToolbarItem}, reached from the Insert menu instead.
 *
 * @param label - Visible text and accessible name. Default: `'Flowchart'`.
 */
export function flowchartSlashCommand(label: string = 'Flowchart'): SlashCommand {
  return {
    id: 'flowchart',
    label,
    run: insertFlowchart,
  };
}
