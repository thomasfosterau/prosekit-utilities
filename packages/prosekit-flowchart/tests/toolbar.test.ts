/**
 * Unit tests for the toolbar and insert-menu entries.
 *
 * Both factories reach `insertNode` by name through `editor.commands`, which
 * is what makes the entry inert against an extension that never registered
 * `defineFlowchart()` instead of throwing on every click. So each case runs
 * the entry against a real mounted editor, with and without the flowchart
 * node. What is pinned: the payload a fresh block carries (read back out of
 * the document), the focus hand-back, the labels, and that two insertions
 * never share one diagram object.
 *
 * Ported from the flowchart button and `slashFlowchart` entry of Website's
 * `BlockToolbar.svelte`.
 *
 * @module
 */

import type { Extension } from 'prosekit/core';
import { createEditor, defineBaseCommands, union } from 'prosekit/core';
import { defineDoc } from 'prosekit/extensions/doc';
import { defineParagraph } from 'prosekit/extensions/paragraph';
import { defineText } from 'prosekit/extensions/text';
import type { ToolbarRunContext } from '@thomasfosterau/prosekit-svelte';
import { describe, expect, it, onTestFinished, vi } from 'vite-plus/test';
import { defineFlowchart } from '../src/lib/node/flowchart-node.ts';
import type { FlowchartData } from '../src/lib/node/schema.ts';
import { flowchartSlashCommand, flowchartToolbarItem } from '../src/lib/toolbar.ts';

/** The starter diagram both entries insert, as Website's own button did. */
const STARTER: FlowchartData = {
  nodes: [{ id: 'n-start', position: { x: 120, y: 80 }, data: { label: 'Start' } }],
  edges: [],
};

/**
 * A `ToolbarRunContext` over a real, mounted editor carrying ProseKit's base
 * commands (`insertNode` among them). With `flowchart` false the grammar has
 * no flowchart node.
 */
const context = (flowchart: boolean = true) => {
  const base: Extension = union(defineDoc(), defineText(), defineParagraph(), defineBaseCommands());
  const editor = createEditor({ extension: flowchart ? union(base, defineFlowchart()) : base });
  editor.mount(document.createElement('div'));
  onTestFinished(() => editor.unmount());
  const focus = vi.spyOn(editor, 'focus');
  const run: ToolbarRunContext = {
    editor,
    dialogs: { link: vi.fn<() => void>(), image: vi.fn<() => void>() },
  };
  /** The `data` of every flowchart node in the document, in order. */
  const diagrams = (): Array<unknown> => {
    const found: Array<unknown> = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'flowchart') found.push(node.attrs['data']);
    });
    return found;
  };
  return { run, focus, diagrams };
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
    const { run, focus, diagrams } = context();

    flowchartToolbarItem().run(run);

    expect(diagrams()).toEqual([STARTER]);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('gives every insertion its own diagram object', () => {
    const { run, diagrams } = context();

    flowchartToolbarItem().run(run);
    flowchartToolbarItem().run(run);

    const [first, second] = diagrams();
    expect(first).toEqual(STARTER);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it('does nothing but refocus when the grammar has no flowchart node', () => {
    const { run, focus, diagrams } = context(false);

    expect(() => flowchartToolbarItem().run(run)).not.toThrow();
    expect(diagrams()).toEqual([]);
    expect(focus).toHaveBeenCalledTimes(1);
  });
});

describe('flowchartSlashCommand', () => {
  it('is the same insertion, reached from the insert menu', () => {
    const { run, focus, diagrams } = context();
    const command = flowchartSlashCommand();

    expect(command.id).toBe('flowchart');
    expect(command.label).toBe('Flowchart');

    command.run(run);

    expect(diagrams()).toEqual([STARTER]);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('takes its label as an argument', () => {
    expect(flowchartSlashCommand('Diagramme').label).toBe('Diagramme');
  });
});
