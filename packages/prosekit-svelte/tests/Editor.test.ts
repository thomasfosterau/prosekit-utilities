/**
 * `Editor` — the mount, the wrapper's accessible name, and the `content`
 * binding. Real typing in Chromium: ProseMirror builds its document out of
 * real selection and real input events, and a DOM shim produces neither.
 */

import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
import { expect, test } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import Editor from '../src/lib/editor/Editor.svelte';
import EditorFixture from './fixtures/EditorFixture.svelte';
import { boundContent, proseMirror, typeInEditor } from './helpers.ts';

test('mounts a contenteditable ProseMirror node', async () => {
  await render(Editor, { extension: defineBlockDocumentExtension() });

  const mounted = proseMirror().element();
  expect(mounted).toHaveClass('ProseMirror');
  expect(mounted.getAttribute('contenteditable')).toBe('true');
});

test('the wrapper takes no role without `label`', async () => {
  const screen = await render(Editor, { extension: defineBlockDocumentExtension() });

  expect(screen.getByRole('group').elements()).toHaveLength(0);
});

test('`label` names the wrapper group', async () => {
  const screen = await render(Editor, {
    extension: defineBlockDocumentExtension(),
    label: 'Post body',
  });

  await expect.element(screen.getByRole('group')).toHaveAccessibleName('Post body');
});

test('typing updates the bound `content`', async () => {
  await render(EditorFixture, {});

  await typeInEditor('Hedgerow');

  await expect.element(proseMirror()).toHaveTextContent('Hedgerow');
  expect(boundContent()).toMatchObject({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hedgerow' }] }],
  });
});

test('seeds from `defaultContent`, and keeps it as the user types', async () => {
  await render(EditorFixture, {
    defaultContent: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Seeded' }] }],
    },
  });

  await expect.element(proseMirror()).toHaveTextContent('Seeded');

  await typeInEditor('!');

  await expect.element(proseMirror()).toHaveTextContent('Seeded');
  expect(JSON.stringify(boundContent())).toContain('Seeded');
});

test('merges the caller `class` onto the wrapper and spreads native attributes', async () => {
  const screen = await render(Editor, {
    extension: defineBlockDocumentExtension(),
    label: 'Body',
    class: 'ring-2',
    'data-surface': 'post',
  });

  const group = screen.getByRole('group').element();
  expect(group).toHaveClass('ring-2');
  expect(group.getAttribute('data-surface')).toBe('post');
});
