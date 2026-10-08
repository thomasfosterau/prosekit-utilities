/**
 * `InlineEditor` — the same envelope remap and hidden input as
 * `BlockEditor`, plus the one thing only this component promises: Enter does
 * not make a second line.
 *
 * That promise needs a real browser twice over. The key has to be a real
 * keydown for ProseMirror's keymap to see it, and "no second block" can only
 * be read off the document the editor actually built.
 */

import { expect, test } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser';
import type { ComponentProps } from 'svelte';
import { render } from 'vitest-browser-svelte';
import InlineEditor from '../src/lib/editor/InlineEditor.svelte';
import { hiddenInputValue, labellingElement, proseMirror, typeInEditor } from './helpers.ts';

test('the hidden input carries the envelope-typed document after typing', async () => {
  await render(InlineEditor, { name: 'title' });

  await typeInEditor('Sorrel');

  expect(hiddenInputValue('title')).toMatchObject({
    type: 'inlineDocument',
    content: [{ type: 'text', text: 'Sorrel' }],
  });
});

test('seeds from an envelope-typed `defaultContent` without throwing', async () => {
  await render(InlineEditor, {
    name: 'title',
    defaultContent: { type: 'inlineDocument', content: [{ type: 'text', text: 'Seeded' }] },
  });

  await expect.element(proseMirror()).toHaveTextContent('Seeded');
  expect(hiddenInputValue('title')).toMatchObject({ type: 'inlineDocument' });
});

test('`documentType` overrides the envelope name', async () => {
  await render(InlineEditor, { name: 'title', documentType: 'inlineTitle' });

  await typeInEditor('Yarrow');

  expect(hiddenInputValue('title')).toMatchObject({ type: 'inlineTitle' });
});

test('Enter inserts nothing — no second block, no line break', async () => {
  await render(InlineEditor, { name: 'title' });

  await typeInEditor('One');
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard('Two');

  const document_ = hiddenInputValue('title') as { content: ReadonlyArray<{ type: string }> };
  expect(document_.content.every((child) => child.type === 'text')).toBe(true);
  expect(proseMirror().element().querySelectorAll('p')).toHaveLength(0);
  await expect.element(proseMirror()).toHaveTextContent('OneTwo');
});

test('`label` names the wrapper group', async () => {
  const screen = await render(InlineEditor, { label: 'Title' });

  await expect.element(screen.getByRole('group')).toHaveAccessibleName('Title');
});

test('renders no toolbar', async () => {
  const screen = await render(InlineEditor, {});

  expect(screen.getByRole('toolbar').elements()).toHaveLength(0);
});

test('spreads native attributes on the wrapper and merges the caller `class`', async () => {
  const screen = await render(InlineEditor, {
    label: 'Title',
    class: 'ring-2',
    id: 'post-title',
    'data-surface': 'title',
    'aria-describedby': 'post-title-hint',
  });

  const group = screen.getByRole('group');
  await expect.element(group).toHaveAttribute('id', 'post-title');
  await expect.element(group).toHaveAttribute('data-surface', 'title');
  await expect.element(group).toHaveAttribute('aria-describedby', 'post-title-hint');
  await expect.element(group).toHaveClass('ring-2', 'flex', 'flex-col');
});

test('`label` owns the accessible name: `aria-label` / `aria-labelledby` are no props, and lose at runtime', async () => {
  // The type half: neither is a prop. `svelte-check` runs over `tests/`, so
  // `vp run check` fails if either directive goes unused — that is, if the
  // props type ever accepts the attribute again.
  const withAriaLabel: ComponentProps<typeof InlineEditor> = {
    // @ts-expect-error -- `label` owns the wrapper's accessible name.
    'aria-label': 'Ignored',
  };
  const withAriaLabelledBy: ComponentProps<typeof InlineEditor> = {
    // @ts-expect-error -- `label` owns the wrapper's accessible name.
    'aria-labelledby': 'inline-editor-hijack',
  };
  labellingElement('inline-editor-hijack', 'Hijacked');

  // The runtime half: an untyped caller still gets `label`, through `Editor`.
  const screen = await render(InlineEditor, {
    ...withAriaLabel,
    ...withAriaLabelledBy,
    label: 'Title',
  });

  const group = screen.getByRole('group');
  await expect.element(group).toHaveAccessibleName('Title');
  await expect.element(group).toHaveAttribute('aria-label', 'Title');
  await expect.element(group).not.toHaveAttribute('aria-labelledby');
});
