/**
 * `SlashMenu` standalone — the insert menu without a `BlockToolbar` around
 * it, which is how a custom toolbar uses it.
 *
 * The applications this package was extracted from rendered this as a
 * `role="listbox"` of plain `<button>`s, with no `aria-expanded`, no focus
 * management and no Escape. Every one of those is pinned here.
 */

import { expect, test, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser';
import type { ComponentProps } from 'svelte';
import { render } from 'vitest-browser-svelte';
import type { SlashCommand } from '../src/lib/toolbar/items.ts';
import type SlashMenu from '../src/lib/toolbar/SlashMenu.svelte';
import SlashMenuFixture from './fixtures/SlashMenuFixture.svelte';
import { labellingElement, proseMirror } from './helpers.ts';

const commands = (run: () => void): ReadonlyArray<SlashCommand> => [
  { id: 'one', label: 'Sow', run },
  { id: 'two', label: 'Plant', run },
  { id: 'three', label: 'Harvest', run },
];

test('the trigger announces the popup and its state', async () => {
  const screen = await render(SlashMenuFixture, { commands: commands(() => undefined) });

  const trigger = screen.getByRole('button', { name: 'Insert' });
  await expect.element(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();

  await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect.element(screen.getByRole('menu')).toHaveAccessibleName('Insert block');
});

test('the entries are menu items, and the styling list never comes between them', async () => {
  const screen = await render(SlashMenuFixture, { commands: commands(() => undefined) });

  await screen.getByRole('button', { name: 'Insert' }).click();

  for (const name of ['Sow', 'Plant', 'Harvest']) {
    await expect.element(screen.getByRole('menuitem', { name })).toBeInTheDocument();
  }

  const menu = screen.getByRole('menu').element();
  expect(menu.querySelector('ul')?.getAttribute('role')).toBe('none');
  expect(menu.querySelectorAll('li[role="none"]')).toHaveLength(3);
});

test('arrow keys move between items and Escape closes, returning focus', async () => {
  const screen = await render(SlashMenuFixture, { commands: commands(() => undefined) });

  const trigger = screen.getByRole('button', { name: 'Insert' });
  await trigger.click();

  await userEvent.keyboard('{ArrowDown}');
  await expect.element(screen.getByRole('menuitem', { name: 'Sow' })).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}');
  await expect.element(screen.getByRole('menuitem', { name: 'Plant' })).toHaveFocus();

  await userEvent.keyboard('{Escape}');

  expect(screen.getByRole('menu').elements()).toHaveLength(0);
  await expect.element(trigger).toHaveFocus();
});

test('choosing an entry runs it with the editor and leaves focus in the document', async () => {
  const run = vi.fn();
  const screen = await render(SlashMenuFixture, { commands: commands(run) });

  await screen.getByRole('button', { name: 'Insert' }).click();
  await screen.getByRole('menuitem', { name: 'Plant' }).click();

  expect(run).toHaveBeenCalledOnce();
  const context = run.mock.calls[0]?.[0] as { editor: { mounted: boolean } };
  expect(context.editor.mounted).toBe(true);
  await expect.element(proseMirror()).toHaveFocus();
});

test('a command asking for a dialog outside a toolbar is inert, not broken', async () => {
  const screen = await render(SlashMenuFixture, {
    commands: [
      {
        id: 'image',
        label: 'Image',
        run: ({ dialogs }) => dialogs.image(),
      },
    ],
  });

  await screen.getByRole('button', { name: 'Insert' }).click();
  await screen.getByRole('menuitem', { name: 'Image' }).click();

  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
  // Focus is NOT pulled back: the command asked for a dialog, and the menu
  // has no way to know none opened.
  await expect.element(screen.getByRole('button', { name: 'Insert' })).toBeInTheDocument();
});

test('`label` and `menuLabel` are props', async () => {
  const screen = await render(SlashMenuFixture, {
    commands: commands(() => undefined),
    label: 'Hinzufügen',
    menuLabel: 'Block einfügen',
  });

  await screen.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect.element(screen.getByRole('menu')).toHaveAccessibleName('Block einfügen');
});

test('the `trigger` snippet replaces the default button', async () => {
  const screen = await render(SlashMenuFixture, {
    commands: commands(() => undefined),
    withTrigger: true,
  });

  const trigger = screen.getByTestId('own-trigger');
  await expect.element(trigger).toHaveAttribute('aria-haspopup', 'menu');

  await trigger.click();

  await expect.element(screen.getByRole('menu')).toBeInTheDocument();
});

test('spreads native attributes on the menu element; `class` stays on the styling list', async () => {
  const screen = await render(SlashMenuFixture, {
    commands: commands(() => undefined),
    attributes: {
      class: 'w-72',
      id: 'insert-menu',
      'data-surface': 'insert',
      'aria-describedby': 'insert-menu-hint',
    },
  });

  const trigger = screen.getByRole('button', { name: 'Insert' });
  await trigger.click();

  const menu = screen.getByRole('menu');
  await expect.element(menu).toHaveAttribute('id', 'insert-menu');
  await expect.element(menu).toHaveAttribute('data-surface', 'insert');
  await expect.element(menu).toHaveAttribute('aria-describedby', 'insert-menu-hint');
  await expect.element(menu).toHaveAccessibleName('Insert block');
  await expect.element(trigger).toHaveAttribute('aria-controls', 'insert-menu');

  const list = menu.element().querySelector('ul');
  expect(list).toHaveClass('w-72', 'menu');
  expect(list?.getAttribute('role')).toBe('none');
});

test('`menuLabel` owns the accessible name: `aria-label` / `aria-labelledby` are no props, and lose at runtime', async () => {
  // The type half: neither is a prop. `svelte-check` runs over `tests/`, so
  // `vp run check` fails if either directive goes unused — that is, if the
  // props type ever accepts the attribute again.
  const withAriaLabel: Omit<ComponentProps<typeof SlashMenu>, 'commands'> = {
    // @ts-expect-error -- `menuLabel` owns the menu's accessible name.
    'aria-label': 'Ignored',
  };
  const withAriaLabelledBy: Omit<ComponentProps<typeof SlashMenu>, 'commands'> = {
    // @ts-expect-error -- `menuLabel` owns the menu's accessible name.
    'aria-labelledby': 'menu-hijack',
  };
  labellingElement('menu-hijack', 'Hijacked');

  // The runtime half: spread before the component's own attributes, an
  // untyped caller's `aria-label` is overridden and its `aria-labelledby`
  // cleared.
  const screen = await render(SlashMenuFixture, {
    commands: commands(() => undefined),
    attributes: { ...withAriaLabel, ...withAriaLabelledBy, id: 'insert-menu' },
  });

  await screen.getByRole('button', { name: 'Insert' }).click();

  const menu = screen.getByRole('menu');
  await expect.element(menu).toHaveAttribute('id', 'insert-menu');
  await expect.element(menu).toHaveAccessibleName('Insert block');
  await expect.element(menu).toHaveAttribute('aria-label', 'Insert block');
  await expect.element(menu).not.toHaveAttribute('aria-labelledby');
});
