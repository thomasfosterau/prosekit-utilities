/**
 * The messages context — the optional per-render-site copy override.
 *
 * Two facts matter and neither is visible from the module alone: an override
 * reaches the components' prop defaults, and no provider at all is the
 * normal case rather than an error. Both are asserted through a rendered
 * toolbar, because `setContext` is only legal during a component's
 * initialisation.
 */

import { expect, test } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import {
  createDefaultSlashCommands,
  createDefaultToolbarItems,
  isToolbarSeparator,
  type ToolbarItem,
  type ToolbarSeparator,
} from '../src/lib/toolbar/items.ts';
import { defaultEditorMessages } from '../src/lib/messages.svelte.ts';
import MessagesFixture from './fixtures/MessagesFixture.svelte';

const onlyButtons = (
  items: ReadonlyArray<ToolbarItem | ToolbarSeparator>,
): ReadonlyArray<ToolbarItem> =>
  items.filter((item): item is ToolbarItem => !isToolbarSeparator(item));

test('with no provider mounted, every string is its English default', async () => {
  const screen = await render(MessagesFixture, {});

  await expect
    .element(screen.getByRole('toolbar'))
    .toHaveAccessibleName(defaultEditorMessages.toolbarLabel);
  await expect.element(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  await expect
    .element(screen.getByRole('button', { name: 'Insert', exact: true }))
    .toBeInTheDocument();
});

test('a partial override reaches the toolbar, and unlisted keys stay English', async () => {
  const screen = await render(MessagesFixture, {
    overrides: { toolbarLabel: 'Werkzeugleiste', bold: 'Fett', slashParagraph: 'Absatz' },
  });

  await expect.element(screen.getByRole('toolbar')).toHaveAccessibleName('Werkzeugleiste');
  await expect.element(screen.getByRole('button', { name: 'Fett' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bold' }).elements()).toHaveLength(0);

  // Un-overridden: still English.
  await expect.element(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();

  await screen.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect.element(screen.getByRole('menuitem', { name: 'Absatz' })).toBeInTheDocument();
  await expect.element(screen.getByRole('menuitem', { name: 'Blockquote' })).toBeInTheDocument();
});

test('the default sets carry one label per message key, and take an override', async () => {
  const items = createDefaultToolbarItems();
  const buttons = onlyButtons(items);
  const slash = createDefaultSlashCommands();

  expect(buttons).toHaveLength(19);
  expect(items.filter(isToolbarSeparator)).toHaveLength(2);
  expect(slash).toHaveLength(10);

  expect(buttons.map((item) => item.label)).toEqual([
    'Bold',
    'Italic',
    'Underline',
    'Strike',
    'Highlight',
    'Sub',
    'Sup',
    'Link',
    'P',
    'H2',
    'Quote',
    'Bullets',
    'Numbered',
    'Code',
    'Rule',
    'Table',
    'Image',
    'Undo',
    'Redo',
  ]);

  const overridden = onlyButtons(createDefaultToolbarItems({ bold: 'Fett' }));
  expect(overridden[0]?.label).toBe('Fett');
  expect(overridden[1]?.label).toBe('Italic');

  expect(createDefaultSlashCommands({ slashTable: 'Tabelle' })[7]?.label).toBe('Tabelle');
});

test('every message key is a non-empty string', () => {
  const entries = Object.entries(defaultEditorMessages);
  expect(entries.length).toBeGreaterThan(0);
  for (const [key, value] of entries) {
    expect(typeof value, key).toBe('string');
    expect(value.length, key).toBeGreaterThan(0);
  }
});
