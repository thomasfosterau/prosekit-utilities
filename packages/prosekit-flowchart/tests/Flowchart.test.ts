/**
 * Browser tests for `Flowchart` — the `@xyflow/svelte` canvas.
 *
 * Real Chromium, because the canvas measures its own box: a DOM shim reports
 * zero for every dimension and Svelte Flow renders nothing into it, so a
 * passing test there would prove nothing. Each of the three instance methods
 * is driven through `FlowchartFixture`, which binds the component and exposes
 * them as named buttons (a `.ts` test has no template to `bind:this` in).
 *
 * What is pinned: the container spreads native attributes and merges the
 * caller's `class` last; each payload node arrives as an `EditableNode`;
 * `getSnapshot()` round-trips what `resetTo()` was given; `addNode()` appends
 * with the label it was handed (or the `newNodeLabel` default); and
 * `interactive={false}` renders no `Controls`, so a published diagram offers
 * no affordance it would refuse to honour.
 *
 * @module
 */

import { expect, test } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import type { FlowchartData } from '../src/lib/node/schema.ts';
import FlowchartFixture from './fixtures/FlowchartFixture.svelte';

const TWO_NODES: FlowchartData = {
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Start' } },
    { id: 'b', position: { x: 0, y: 120 }, data: { label: 'Finish' } },
  ],
  edges: [{ id: 'a-b', source: 'a', target: 'b' }],
};

/** Just enough of a render result to read the fixture's published snapshot. */
interface SnapshotReader {
  getByRole: (role: 'button', options: { name: string }) => { click: () => Promise<void> };
  getByTestId: (id: string) => { element: () => HTMLElement | SVGElement };
}

/** Press "Snapshot", then read back what `getSnapshot()` returned. */
const snapshot = async (screen: SnapshotReader): Promise<FlowchartData> => {
  await screen.getByRole('button', { name: 'Snapshot' }).click();
  return JSON.parse(screen.getByTestId('snapshot').element().textContent ?? '') as FlowchartData;
};

test('renders a container that keeps the caller’s attributes', async () => {
  const screen = await render(FlowchartFixture, { data: TWO_NODES });

  const container = screen.getByTestId('canvas').element();
  expect(container.classList.contains('flowchart-canvas')).toBe(true);
  // The default `class` is still merged — the caller's goes last, so it wins.
  expect(container.classList.contains('h-96')).toBe(true);
});

test('mounts the canvas with each payload node as an EditableNode', async () => {
  const screen = await render(FlowchartFixture, { data: TWO_NODES });

  await expect
    .element(screen.getByRole('button', { name: 'Start', exact: false }))
    .toBeInTheDocument();
  await expect
    .element(screen.getByRole('button', { name: 'Finish', exact: false }))
    .toBeInTheDocument();
});

test('an empty payload mounts an empty canvas', async () => {
  // `summaryLabel` has no assertion here and cannot have one: it is the
  // `typeof window === 'undefined'` branch, and this suite runs in a real
  // browser where that branch is unreachable by construction.
  const screen = await render(FlowchartFixture, { data: { nodes: [], edges: [] } });

  expect(await snapshot(screen)).toEqual({ nodes: [], edges: [] });
});

test('getSnapshot round-trips what resetTo was given', async () => {
  const screen = await render(FlowchartFixture, {
    data: { nodes: [], edges: [] },
    resetPayload: TWO_NODES,
  });

  await screen.getByRole('button', { name: 'Reset' }).click();
  await expect
    .element(screen.getByRole('button', { name: 'Start', exact: false }))
    .toBeInTheDocument();

  expect(await snapshot(screen)).toEqual(TWO_NODES);
});

test('addNode appends a node carrying the default label', async () => {
  const screen = await render(FlowchartFixture, {
    data: { nodes: [], edges: [] },
    interactive: true,
  });

  await screen.getByRole('button', { name: 'Add node' }).click();

  const after = await snapshot(screen);
  expect(after.nodes).toHaveLength(1);
  expect(after.nodes[0]?.data.label).toBe('New');
  expect(after.edges).toEqual([]);
});

test('addNode takes an explicit label', async () => {
  const screen = await render(FlowchartFixture, {
    data: { nodes: [], edges: [] },
    addLabel: 'Decision',
  });

  await screen.getByRole('button', { name: 'Add node' }).click();

  expect((await snapshot(screen)).nodes[0]?.data.label).toBe('Decision');
});

test('newNodeLabel changes what an unlabelled addNode writes', async () => {
  const screen = await render(FlowchartFixture, {
    data: { nodes: [], edges: [] },
    newNodeLabel: 'Étape',
  });

  await screen.getByRole('button', { name: 'Add node' }).click();

  expect((await snapshot(screen)).nodes[0]?.data.label).toBe('Étape');
});

test('addNode staggers each new node rather than piling them up', async () => {
  const screen = await render(FlowchartFixture, { data: { nodes: [], edges: [] } });

  await screen.getByRole('button', { name: 'Add node' }).click();
  await screen.getByRole('button', { name: 'Add node' }).click();

  const after = await snapshot(screen);
  expect(after.nodes).toHaveLength(2);
  expect(after.nodes[0]?.position).not.toEqual(after.nodes[1]?.position);
});

test('a read-only canvas offers no Controls', async () => {
  const screen = await render(FlowchartFixture, { data: TWO_NODES, interactive: false });

  await expect
    .element(screen.getByRole('button', { name: 'Start', exact: false }))
    .toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Zoom In' }).elements()).toHaveLength(0);
});

test('an interactive canvas offers the Controls', async () => {
  const screen = await render(FlowchartFixture, { data: TWO_NODES, interactive: true });

  await expect.element(screen.getByRole('button', { name: 'Zoom In' })).toBeInTheDocument();
});
