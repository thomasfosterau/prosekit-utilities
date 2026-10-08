/**
 * Browser tests for `FlowchartEditDialog` — the modal that hosts the canvas.
 *
 * The modal contract asserted here is bits-ui's (a named and described
 * `dialog`, focus moved inside, Escape), and it is asserted precisely because
 * it is what a call site is promised. The one piece that is NOT bits-ui's is
 * the pending guard: a save in flight must survive an Escape, which a native
 * `<dialog>` — what the source app used — cannot express at all.
 *
 * Real key presses and clicks in Chromium: the canvas inside measures its own
 * box, and focus order is not something a DOM shim models.
 *
 * @module
 */

import { beforeAll, expect, test, vi } from 'vite-plus/test';
import { userEvent, type Locator } from 'vite-plus/test/browser';
import { render } from 'vitest-browser-svelte';
import FlowchartEditDialog from '../src/lib/FlowchartEditDialog.svelte';
import type { FlowchartData } from '../src/lib/node/schema.ts';
import FlowchartEditDialogFixture from './fixtures/FlowchartEditDialogFixture.svelte';

const ONE_NODE: FlowchartData = {
  nodes: [{ id: 'n-start', position: { x: 120, y: 80 }, data: { label: 'Start' } }],
  edges: [],
};

const OTHER_NODE: FlowchartData = {
  nodes: [{ id: 'n-other', position: { x: 10, y: 10 }, data: { label: 'Elsewhere' } }],
  edges: [],
};

/**
 * The dialog sizes its canvas with Tailwind's `h-full`, and this suite ships no
 * Tailwind — so `.svelte-flow` measures zero, every node is laid out outside
 * the box, and a real pointer aimed at one hits the wrapper instead. Supplying
 * that single rule is cheaper and more honest than asserting layout: nothing
 * else about these components' appearance is pinned here.
 */
beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = '.h-full { height: 100%; }';
  document.head.append(style);
});

/** Just enough of what `render` hands back for the two helpers below. */
interface Screen {
  getByRole: (role: string, options?: { name: string; exact?: boolean }) => Locator;
}

/**
 * The canvas arrives behind a dynamic `import()`, so nothing that reads a
 * snapshot may run until its first node is on screen.
 */
const canvasReady = async (screen: Screen, name: string): Promise<void> => {
  await expect.element(screen.getByRole('button', { name, exact: false })).toBeInTheDocument();
};

test('opens as a dialog named by the title and described by the help text', async () => {
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    onSave: vi.fn(),
  });

  const dialog = screen.getByRole('dialog');
  await expect.element(dialog).toHaveAccessibleName('Edit flowchart');
  await expect
    .element(dialog)
    .toHaveAccessibleDescription(
      "Drag from a node's bottom to another's top to connect. Double-click a node to edit its label. Select and press Delete to remove.",
    );
});

test('spreads native attributes on the dialog element, merges `class`, and keeps the modal wiring', async () => {
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    onSave: vi.fn(),
    class: 'max-w-4xl',
    id: 'flowchart-dialog',
    'data-surface': 'flowchart',
    'aria-keyshortcuts': 'Delete',
    // Competing values for what the modal contract owns: each one loses.
    role: 'region',
    'aria-modal': 'false',
    'aria-labelledby': 'ignored',
    'aria-describedby': 'ignored',
    'aria-label': 'Ignored',
  });

  const dialog = screen.getByRole('dialog');
  await expect.element(dialog).toHaveAttribute('id', 'flowchart-dialog');
  await expect.element(dialog).toHaveAttribute('data-surface', 'flowchart');
  await expect.element(dialog).toHaveAttribute('aria-keyshortcuts', 'Delete');
  await expect.element(dialog).toHaveAttribute('aria-modal', 'true');
  await expect.element(dialog).toHaveAccessibleName('Edit flowchart');
  await expect
    .element(dialog)
    .toHaveAccessibleDescription(
      "Drag from a node's bottom to another's top to connect. Double-click a node to edit its label. Select and press Delete to remove.",
    );
  await expect.element(dialog).toHaveClass('max-w-4xl', 'modal-box');
});

test('every string is a prop', async () => {
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    onSave: vi.fn(),
    titleLabel: 'Modifier le diagramme',
    addNodeLabel: 'Ajouter',
    helpText: 'Glissez pour relier.',
    saveLabel: 'Enregistrer',
    cancelLabel: 'Annuler',
    closeLabel: 'Fermer',
  });

  await expect.element(screen.getByRole('dialog')).toHaveAccessibleName('Modifier le diagramme');
  await expect.element(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  await expect.element(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
});

test('focus lands inside the dialog', async () => {
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    onSave: vi.fn(),
  });

  await expect.element(screen.getByRole('dialog')).toBeInTheDocument();
  const dialog = screen.getByRole('dialog').element();
  await vi.waitFor(() => {
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

test('Save hands onSave the current snapshot and closes', async () => {
  const onSave = vi.fn();
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    onSave,
  });
  await canvasReady(screen, 'Start');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave.mock.calls[0]?.[0]).toEqual(ONE_NODE);
  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
});

test('Add node appends to the diagram Save reports', async () => {
  const onSave = vi.fn();
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    onSave,
  });
  await canvasReady(screen, 'Start');

  await userEvent.click(screen.getByRole('button', { name: 'Add node' }));
  await expect
    .element(screen.getByRole('button', { name: 'New', exact: false }))
    .toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  const saved = onSave.mock.calls[0]?.[0] as FlowchartData;
  expect(saved.nodes).toHaveLength(2);
  expect(saved.nodes[1]?.data.label).toBe('New');
});

test('a rejecting onSave shows an alert and keeps the dialog open', async () => {
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    onSave: () => Promise.reject(new Error('The server said no.')),
  });
  await canvasReady(screen, 'Start');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await expect.element(screen.getByRole('alert')).toHaveTextContent('The server said no.');
  await expect.element(screen.getByRole('dialog')).toBeInTheDocument();
});

test('a non-Error rejection falls back to the failure message prop', async () => {
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    // Deliberately not an `Error`: that is the branch `failureMessage` exists for.
    onSave: () => Promise.reject('nope'),
    failureMessage: 'Could not save.',
  });
  await canvasReady(screen, 'Start');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not save.');
});

test('the node copy is forwarded to the canvas the dialog hosts', async () => {
  const onSave = vi.fn();
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    onSave,
    nodeLabelLabel: 'Étiquette du nœud',
    untitledLabel: 'Sans titre',
  });
  await canvasReady(screen, 'Start');

  // Edit a node inside the dialog and commit it blank: both strings are the
  // canvas's, and only reach it because the dialog forwards them.
  await screen.getByRole('button', { name: 'Start', exact: false }).dblClick();
  await screen.getByRole('textbox', { name: 'Étiquette du nœud' }).fill('   ');
  await userEvent.keyboard('{Enter}');

  await expect
    .element(screen.getByRole('button', { name: 'Sans titre', exact: false }))
    .toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  const saved = onSave.mock.calls[0]?.[0] as FlowchartData;
  expect(saved.nodes[0]?.data.label).toBe('Sans titre');
});

test('Cancel closes without calling onSave', async () => {
  const onSave = vi.fn();
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    onSave,
  });
  await canvasReady(screen, 'Start');

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
  expect(onSave).not.toHaveBeenCalled();
});

test('Escape closes an idle dialog', async () => {
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    onSave: vi.fn(),
  });
  await canvasReady(screen, 'Start');

  await userEvent.keyboard('{Escape}');

  await vi.waitFor(() => {
    expect(screen.getByRole('dialog').elements()).toHaveLength(0);
  });
});

test('Escape is ignored while a save is in flight, and both buttons are disabled', async () => {
  const screen = await render(FlowchartEditDialog, {
    open: true,
    initialData: ONE_NODE,
    // Never settles: the dialog stays in its pending state for the whole test.
    onSave: () => new Promise<void>(() => {}),
  });
  await canvasReady(screen, 'Start');

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await expect.element(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await expect.element(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

  await userEvent.keyboard('{Escape}');

  await expect.element(screen.getByRole('dialog')).toBeInTheDocument();
});

test('the imperative open(data) seeds the canvas with that payload', async () => {
  const onSave = vi.fn();
  const screen = await render(FlowchartEditDialogFixture, {
    initialData: ONE_NODE,
    openWith: OTHER_NODE,
    onSave,
  });

  await expect.element(screen.getByTestId('open-state')).toHaveTextContent('closed');
  await userEvent.click(screen.getByRole('button', { name: 'Open the diagram' }));

  await expect.element(screen.getByTestId('open-state')).toHaveTextContent('open');
  await expect
    .element(screen.getByRole('button', { name: 'Elsewhere', exact: false }))
    .toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onSave.mock.calls[0]?.[0]).toEqual(OTHER_NODE);
});
