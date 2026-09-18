/**
 * Unit tests for the toolbar and insert-menu entries.
 *
 * Neither factory needs an editor, only something shaped like one: both reach
 * `insertNode` by name through `editor.commands`, which is what makes the
 * entry inert against an extension that never registered `defineFlowchart()`
 * instead of throwing on every click. So the editor here is a stand-in, and
 * what is pinned is the payload a fresh block carries, the focus hand-back,
 * the labels, and that two insertions never share one diagram object.
 *
 * Ported from the flowchart button and `slashFlowchart` entry of Website's
 * `BlockToolbar.svelte`.
 *
 * @module
 */

import type { ToolbarRunContext } from '@thomasfosterau/prosekit-svelte';
import { describe, expect, it, vi } from 'vite-plus/test';
import type { FlowchartData } from '../src/lib/node/schema.ts';
import { flowchartSlashCommand, flowchartToolbarItem } from '../src/lib/toolbar.ts';

/** The starter diagram both entries insert, as Website's own button did. */
const STARTER: FlowchartData = {
  nodes: [{ id: 'n-start', position: { x: 120, y: 80 }, data: { label: 'Start' } }],
  edges: [],
};

/** What the entries hand ProseKit's `insertNode` command. */
interface InsertNodeOptions {
  type: string;
  attrs: { data: FlowchartData };
}

/** Enough of a `ToolbarRunContext` for an entry that only inserts and focuses. */
const context = () => {
  // Typed rather than `vi.fn(() => true)`: an untyped mock records its calls as
  // an empty tuple, so every `mock.calls[0]?.[0]` below would be a type error.
  const insertNode = vi.fn((_options: InsertNodeOptions) => true);
  const focus = vi.fn();
  const run = {
    editor: { commands: { insertNode }, focus },
    dialogs: { link: vi.fn(), image: vi.fn() },
  } as unknown as ToolbarRunContext;
  return { run, insertNode, focus };
};

describe('flowchartToolbarItem', () => {
  it('is an action, not a toggle, and is labelled in English by default', () => {
    const item = flowchartToolbarItem();
    expect(item.id).toBe('flowchart');
    expect(item.label).toBe('Flowchart');
    expect(item.kind).toBe('action');
    expect(item.isActive).toBeUndefined();
  });

  it('takes its label as an argument', () => {
    expect(flowchartToolbarItem('Diagramme').label).toBe('Diagramme');
  });

  it('inserts a flowchart node carrying the starter diagram, then refocuses', () => {
    const { run, insertNode, focus } = context();

    flowchartToolbarItem().run(run);

    expect(insertNode).toHaveBeenCalledTimes(1);
    expect(insertNode.mock.calls[0]?.[0]).toEqual({
      type: 'flowchart',
      attrs: { data: STARTER },
    });
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('gives every insertion its own diagram object', () => {
    const { run, insertNode } = context();

    flowchartToolbarItem().run(run);
    flowchartToolbarItem().run(run);

    const first = insertNode.mock.calls[0]?.[0];
    const second = insertNode.mock.calls[1]?.[0];
    expect(first?.attrs.data).toEqual(STARTER);
    expect(first?.attrs.data).toEqual(second?.attrs.data);
    expect(first?.attrs.data).not.toBe(second?.attrs.data);
  });

  it('does nothing but refocus when the grammar has no flowchart node', () => {
    const run = {
      editor: { commands: {}, focus: vi.fn() },
      dialogs: { link: vi.fn(), image: vi.fn() },
    } as unknown as ToolbarRunContext;

    expect(() => flowchartToolbarItem().run(run)).not.toThrow();
  });
});

describe('flowchartSlashCommand', () => {
  it('is the same insertion, reached from the insert menu', () => {
    const { run, insertNode, focus } = context();
    const command = flowchartSlashCommand();

    expect(command.id).toBe('flowchart');
    expect(command.label).toBe('Flowchart');

    command.run(run);

    expect(insertNode.mock.calls[0]?.[0]).toEqual({
      type: 'flowchart',
      attrs: { data: STARTER },
    });
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('takes its label as an argument', () => {
    expect(flowchartSlashCommand('Diagramme').label).toBe('Diagramme');
  });
});
