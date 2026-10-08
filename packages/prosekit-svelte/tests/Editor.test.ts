/**
 * `Editor` — the mount, the wrapper's accessible name, and the `content`
 * binding. Real typing in Chromium: ProseMirror builds its document out of
 * real selection and real input events, and a DOM shim produces neither.
 */

import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
import type { ComponentProps } from 'svelte';
import { expect, test } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import Editor from '../src/lib/editor/Editor.svelte';
import EditorFixture from './fixtures/EditorFixture.svelte';
import { boundContent, labellingElement, proseMirror, typeInEditor } from './helpers.ts';

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

test('`label` owns the accessible name: `aria-label` / `aria-labelledby` are no props, and lose at runtime', async () => {
  // The type half: neither is a prop. `svelte-check` runs over `tests/`, so
  // `vp run check` fails if either directive goes unused — that is, if the
  // props type ever accepts the attribute again.
  const withAriaLabel: Omit<ComponentProps<typeof Editor>, 'extension'> = {
    // @ts-expect-error -- `label` owns the wrapper's accessible name.
    'aria-label': 'Ignored',
  };
  const withAriaLabelledBy: Omit<ComponentProps<typeof Editor>, 'extension'> = {
    // @ts-expect-error -- `label` owns the wrapper's accessible name.
    'aria-labelledby': 'editor-hijack',
  };
  labellingElement('editor-hijack', 'Hijacked');

  // The runtime half: an untyped caller still gets `label`.
  const screen = await render(Editor, {
    ...withAriaLabel,
    ...withAriaLabelledBy,
    extension: defineBlockDocumentExtension(),
    label: 'Body',
  });

  const group = screen.getByRole('group');
  await expect.element(group).toHaveAccessibleName('Body');
  await expect.element(group).toHaveAttribute('aria-label', 'Body');
  await expect.element(group).not.toHaveAttribute('aria-labelledby');
});

test('`labelledBy` names the wrapper group by a visible heading', async () => {
  labellingElement('editor-heading', 'Meeting notes', 'h2');

  const screen = await render(Editor, {
    extension: defineBlockDocumentExtension(),
    labelledBy: 'editor-heading',
  });

  // Named, so a group, though `label` is absent.
  const group = screen.getByRole('group');
  await expect.element(group).toHaveAccessibleName('Meeting notes');
  await expect.element(group).toHaveAttribute('aria-labelledby', 'editor-heading');
  await expect.element(group).not.toHaveAttribute('aria-label');
});

test('given both, `labelledBy` wins over `label`', async () => {
  labellingElement('editor-both-heading', 'Meeting notes', 'h2');

  const screen = await render(Editor, {
    extension: defineBlockDocumentExtension(),
    label: 'Body',
    labelledBy: 'editor-both-heading',
  });

  const group = screen.getByRole('group');
  await expect.element(group).toHaveAccessibleName('Meeting notes');
  await expect.element(group).toHaveAttribute('aria-labelledby', 'editor-both-heading');
  await expect.element(group).not.toHaveAttribute('aria-label');
});
