/**
 * `BlockEditor` — the envelope remap, the hidden form input and the toolbar
 * slot.
 *
 * The remap is the reason this component exists as more than an alias for
 * `Editor`: a stored document's root `type` is the application's envelope
 * name, ProseMirror's is always `doc`, and feeding one to the other throws
 * `RangeError: Unknown node type`. Both directions are asserted, and the
 * seeding test's whole point is that it does not throw.
 */

import { expect, test } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import BlockEditor from '../src/lib/editor/BlockEditor.svelte';
import BlockEditorFixture from './fixtures/BlockEditorFixture.svelte';
import { hiddenInputValue, proseMirror, typeInEditor } from './helpers.ts';

const storedDocument = {
  type: 'blockDocument',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Stored' }] }],
} as const;

test('renders the default toolbar', async () => {
  const screen = await render(BlockEditor, {});

  await expect.element(screen.getByRole('toolbar')).toHaveAccessibleName('Editor toolbar');
});

test('the hidden input carries the envelope-typed document after typing', async () => {
  await render(BlockEditor, { name: 'body' });

  await typeInEditor('Compost');

  expect(hiddenInputValue('body')).toMatchObject({
    type: 'blockDocument',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Compost' }] }],
  });
});

test('no `name`, no hidden input', async () => {
  await render(BlockEditor, {});

  expect(document.querySelector('input[type="hidden"]')).toBeNull();
});

test('seeds from an envelope-typed `defaultContent` without throwing', async () => {
  await render(BlockEditor, { name: 'body', defaultContent: storedDocument });

  await expect.element(proseMirror()).toHaveTextContent('Stored');
  // Round-trips: what seeded the editor comes back out in the stored shape.
  expect(hiddenInputValue('body')).toMatchObject({ type: 'blockDocument' });
});

test('`documentType` overrides the envelope name in both directions', async () => {
  await render(BlockEditor, {
    name: 'section',
    documentType: 'articleSection',
    defaultContent: { type: 'articleSection', content: [{ type: 'paragraph' }] },
  });

  await typeInEditor('Rhizome');

  expect(hiddenInputValue('section')).toMatchObject({
    type: 'articleSection',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rhizome' }] }],
  });
});

test('`toolbar={false}` renders no toolbar', async () => {
  const screen = await render(BlockEditor, { toolbar: false });

  await expect.element(proseMirror()).toBeInTheDocument();
  expect(screen.getByRole('toolbar').elements()).toHaveLength(0);
});

test('a `toolbar` snippet replaces the default one', async () => {
  const screen = await render(BlockEditorFixture, {});

  await expect.element(screen.getByTestId('custom-toolbar')).toBeInTheDocument();
  expect(screen.getByRole('toolbar').elements()).toHaveLength(0);
});

test('a custom item set reaches the default toolbar', async () => {
  const screen = await render(BlockEditor, {
    items: [{ id: 'shout', label: 'Shout', run: () => undefined }],
  });

  await expect.element(screen.getByRole('button', { name: 'Shout' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bold' }).elements()).toHaveLength(0);
});

test('spreads native attributes on the wrapper and merges the caller `class`', async () => {
  const screen = await render(BlockEditor, {
    label: 'Body',
    class: 'ring-2',
    id: 'post-body',
    'data-surface': 'post',
    'aria-describedby': 'post-body-hint',
  });

  const group = screen.getByRole('group');
  await expect.element(group).toHaveAttribute('id', 'post-body');
  await expect.element(group).toHaveAttribute('data-surface', 'post');
  await expect.element(group).toHaveAttribute('aria-describedby', 'post-body-hint');
  await expect.element(group).toHaveClass('ring-2', 'flex', 'flex-col');
});
