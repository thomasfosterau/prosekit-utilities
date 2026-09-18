/**
 * The flowchart's toolbar and insert-menu entries.
 *
 * `@thomasfosterau/prosekit-svelte`'s `BlockToolbar` renders a list of values
 * rather than a hard-coded row, so a block that lives in its own package can
 * add itself to a toolbar without either package importing the other's UI.
 * These two factories are that entry: an application appends
 * `flowchartToolbarItem()` to its `items` and `flowchartSlashCommand()` to its
 * `slashCommands`, and gets the same button and menu row the source
 * application had.
 *
 * Both insert the starter diagram the source application used — one node
 * labelled "Start" at (120, 80) — rather than an empty payload, because an
 * empty canvas gives an author nothing to double-click and no anchor to drag a
 * connection from.
 *
 * @module @thomasfosterau/prosekit-flowchart/toolbar
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
 * the same loose lookup the default item set uses — so the entry is inert
 * rather than throwing against an extension that never registered
 * `defineFlowchart()`.
 */
function insertFlowchart({ editor }: ToolbarRunContext): void {
  const commands = editor.commands as Record<string, ((...args: never[]) => boolean) | undefined>;
  commands['insertNode']?.({ type: 'flowchart', attrs: { data: starterDiagram() } } as never);
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
