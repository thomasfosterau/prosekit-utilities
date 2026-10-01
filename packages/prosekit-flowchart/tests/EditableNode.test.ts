/**
 * Browser tests for `EditableNode` — the inline-editable Svelte Flow node.
 *
 * Driven inside the smallest possible `SvelteFlow` (`EditableNodeFixture`),
 * because the component is never rendered directly: Svelte Flow constructs it
 * from `nodeTypes` and `useSvelteFlow()` — the hook a commit writes through —
 * only resolves inside a flow. Real double-clicks and real key presses, so the
 * thing under test is the browser's own activation path rather than an event
 * a spec made up.
 *
 * What is pinned: both ways into edit mode (double-click, and Enter while the
 * node has focus), Enter committing, Escape discarding, a blank label
 * committing as the `untitledLabel` fallback, the field's accessible name,
 * that both strings arrive through the node's `data` (the only channel Svelte
 * Flow leaves open), and that a read-only node is inert and out of the tab
 * order.
 *
 * @module
 */

import { expect, test } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser';
import { render } from 'vitest-browser-svelte';
import EditableNodeFixture from './fixtures/EditableNodeFixture.svelte';

test('names the edit field, and the name arrives through the node data', async () => {
  const screen = await render(EditableNodeFixture, { nodeLabelLabel: 'Étiquette' });

  await screen.getByRole('button', { name: 'Start', exact: false }).dblClick();

  await expect.element(screen.getByRole('textbox', { name: 'Étiquette' })).toBeInTheDocument();
});

test('a double-click opens the field named by the default label', async () => {
  const screen = await render(EditableNodeFixture);

  await screen.getByRole('button', { name: 'Start', exact: false }).dblClick();

  const field = screen.getByRole('textbox', { name: 'Node label' });
  await expect.element(field).toHaveValue('Start');
  await expect.element(field).toHaveFocus();
});

test('Enter on the focused node opens the field too', async () => {
  const screen = await render(EditableNodeFixture);

  await screen.getByRole('button', { name: 'Start', exact: false }).click();
  await userEvent.keyboard('{Enter}');

  await expect.element(screen.getByRole('textbox', { name: 'Node label' })).toBeInTheDocument();
});

test('Enter commits the new label', async () => {
  const screen = await render(EditableNodeFixture);

  await screen.getByRole('button', { name: 'Start', exact: false }).dblClick();
  await screen.getByRole('textbox', { name: 'Node label' }).fill('Dispatch');
  await userEvent.keyboard('{Enter}');

  await expect.element(screen.getByTestId('label')).toHaveTextContent('Dispatch');
  expect(screen.getByRole('textbox', { name: 'Node label' }).elements()).toHaveLength(0);
});

test('Escape discards the edit and restores the label', async () => {
  const screen = await render(EditableNodeFixture);

  await screen.getByRole('button', { name: 'Start', exact: false }).dblClick();
  await screen.getByRole('textbox', { name: 'Node label' }).fill('Abandoned');
  await userEvent.keyboard('{Escape}');

  await expect.element(screen.getByTestId('label')).toHaveTextContent('Start');
  expect(screen.getByRole('textbox', { name: 'Node label' }).elements()).toHaveLength(0);
});

test('a blank label commits as the untitled fallback', async () => {
  const screen = await render(EditableNodeFixture);

  await screen.getByRole('button', { name: 'Start', exact: false }).dblClick();
  await screen.getByRole('textbox', { name: 'Node label' }).fill('   ');
  await userEvent.keyboard('{Enter}');

  await expect.element(screen.getByTestId('label')).toHaveTextContent('Untitled');
});

test('the untitled fallback is overridable through the node data', async () => {
  const screen = await render(EditableNodeFixture, { untitledLabel: 'Sans titre' });

  await screen.getByRole('button', { name: 'Start', exact: false }).dblClick();
  await screen.getByRole('textbox', { name: 'Node label' }).fill('');
  await userEvent.keyboard('{Enter}');

  await expect.element(screen.getByTestId('label')).toHaveTextContent('Sans titre');
});

test('a node whose label is already blank renders the fallback', async () => {
  const screen = await render(EditableNodeFixture, { label: '' });

  await expect
    .element(screen.getByRole('button', { name: 'Untitled', exact: false }))
    .toBeInTheDocument();
});

test('a read-only node is out of the tab order and refuses to open', async () => {
  const screen = await render(EditableNodeFixture, { readOnly: true });

  const node = screen.getByRole('button', { name: 'Start', exact: false });
  await expect.element(node).toHaveAttribute('tabindex', '-1');

  await node.dblClick();

  expect(screen.getByRole('textbox', { name: 'Node label' }).elements()).toHaveLength(0);
  await expect.element(screen.getByTestId('label')).toHaveTextContent('Start');
});
