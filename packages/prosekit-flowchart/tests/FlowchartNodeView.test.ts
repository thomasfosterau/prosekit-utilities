/**
 * Browser tests for `FlowchartNodeView` — what ProseKit mounts in place of a
 * `flowchart` node.
 *
 * The two stores and `setAttrs` are ProseKit's node-view contract, so the test
 * supplies them the way the adapter does: `writable()` values plus a spy. The
 * node is a real one, built from a schema compiled once from
 * `defineFlowchart()`, though this view reads nothing but its `attrs`.
 *
 * What is pinned: the preview is the SAME SVG the server renders (so the
 * editor and the published page cannot drift), the Edit button opens the
 * dialog, saving writes back through `setAttrs`, and the selected state is
 * reflected rather than merely styled.
 *
 * @module
 */

import type { Attrs, Node as ProseMirrorNode } from '@prosekit/pm/model';
import { writable } from 'svelte/store';
import { createEditor, union } from 'prosekit/core';
import { defineDoc } from 'prosekit/extensions/doc';
import { defineParagraph } from 'prosekit/extensions/paragraph';
import { defineText } from 'prosekit/extensions/text';
import { assert, expect, test, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser';
import { render } from 'vitest-browser-svelte';
import FlowchartNodeView from '../src/lib/FlowchartNodeView.svelte';
import { defineFlowchart } from '../src/lib/node/flowchart-node.ts';
import type { FlowchartData } from '../src/lib/node/schema.ts';

const ONE_NODE: FlowchartData = {
  nodes: [{ id: 'n-start', position: { x: 120, y: 80 }, data: { label: 'Start' } }],
  edges: [],
};

/** The `flowchart` node type, compiled once from the real `defineFlowchart()` spec. */
const flowchartType = (() => {
  const { schema } = createEditor({
    extension: union(defineDoc(), defineText(), defineParagraph(), defineFlowchart()),
  });
  const type = schema.nodes['flowchart'];
  assert(type, 'the schema registers flowchart');
  return type;
})();

/** A real `flowchart` node carrying `data`; `attrs` is all `$node` is read for. */
const nodeWith = (data: FlowchartData): ProseMirrorNode => flowchartType.create({ data });

test('renders the server SVG as the preview, and the Edit button', async () => {
  const screen = await render(FlowchartNodeView, {
    node: writable(nodeWith(ONE_NODE)),
    selected: writable(false),
    setAttrs: vi.fn<(attrs: Attrs) => void>(),
  });

  await expect.element(screen.getByRole('img', { name: /Flowchart diagram/ })).toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  // The label is in the SVG, escaped by the package's own serialiser.
  expect(screen.getByRole('img', { name: /Flowchart diagram/ }).element().textContent).toContain(
    'Start',
  );
});

test('an empty payload still renders the empty-state SVG', async () => {
  const screen = await render(FlowchartNodeView, {
    node: writable(nodeWith({ nodes: [], edges: [] })),
    selected: writable(false),
    setAttrs: vi.fn<(attrs: Attrs) => void>(),
  });

  await expect.element(screen.getByRole('img', { name: 'Empty flowchart' })).toBeInTheDocument();
});

test('the Edit button label is a prop', async () => {
  const screen = await render(FlowchartNodeView, {
    node: writable(nodeWith(ONE_NODE)),
    selected: writable(false),
    setAttrs: vi.fn<(attrs: Attrs) => void>(),
    editLabel: 'Modifier',
  });

  await expect.element(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
});

test('a selected node is marked as selected, not merely styled', async () => {
  const selected = writable(false);
  const screen = await render(FlowchartNodeView, {
    node: writable(nodeWith(ONE_NODE)),
    selected,
    setAttrs: vi.fn<(attrs: Attrs) => void>(),
  });

  const view = screen.getByRole('button', { name: 'Edit' }).element().parentElement;
  expect(view?.classList.contains('border-base-300')).toBe(true);

  selected.set(true);
  await vi.waitFor(() => {
    expect(view?.classList.contains('border-primary')).toBe(true);
  });
});

test('Edit opens the dialog, and Save writes the diagram back through setAttrs', async () => {
  const setAttrs = vi.fn<(attrs: Attrs) => void>();
  const screen = await render(FlowchartNodeView, {
    node: writable(nodeWith(ONE_NODE)),
    selected: writable(false),
    setAttrs,
  });

  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

  await expect.element(screen.getByRole('dialog')).toHaveAccessibleName('Edit flowchart');
  // Wait for the canvas behind the dynamic import before pulling a snapshot.
  await expect
    .element(screen.getByRole('button', { name: 'Start', exact: false }))
    .toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(setAttrs).toHaveBeenCalledTimes(1);
  expect(setAttrs.mock.calls[0]?.[0]).toEqual({ data: ONE_NODE });
  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
});
