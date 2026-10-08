/**
 * `BlockToolbar` — the accessibility contract the applications this package
 * was extracted from did not have: one tab stop with arrow-key roving focus,
 * `aria-pressed` on the toggles, a real `role="menu"` behind the insert
 * button, and separators the keyboard skips.
 *
 * Every keypress here is a real one. The old toolbar's "active" state was a
 * CSS class, and no assertion short of reading the accessibility tree after
 * a real click would have caught that.
 */

import { expect, test } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser';
import type { ComponentProps } from 'svelte';
import { render } from 'vitest-browser-svelte';
import type BlockToolbar from '../src/lib/toolbar/BlockToolbar.svelte';
import {
  createDefaultToolbarItems,
  isToolbarSeparator,
  type ToolbarItem,
} from '../src/lib/toolbar/items.ts';
import ToolbarFixture from './fixtures/ToolbarFixture.svelte';
import { labellingElement, proseMirror, typeInEditor } from './helpers.ts';

const defaultItems = createDefaultToolbarItems();
const defaultButtons = defaultItems.filter(
  (item): item is ToolbarItem => !isToolbarSeparator(item),
);

/** Selects the whole document with a real key chord. */
async function selectAll(): Promise<void> {
  await proseMirror().click();
  await userEvent.keyboard('{Control>}a{/Control}');
}

/**
 * Tabs into the toolbar's single tab stop.
 *
 * Clicking a button cannot stand in for this: a run ends by pulling focus
 * back into the document, which is the behaviour the "typing continues" test
 * pins. The toolbar is reached the way a keyboard user reaches it — it comes
 * before the editable node in the DOM, so one Tab from the fixture's start
 * lands on it.
 */
async function tabToToolbar(): Promise<void> {
  await userEvent.tab();
}

test('is a toolbar named by `label`', async () => {
  const screen = await render(ToolbarFixture, { label: 'Note toolbar' });

  await expect.element(screen.getByRole('toolbar')).toHaveAccessibleName('Note toolbar');
});

test('renders every default item as a button carrying its label', async () => {
  const screen = await render(ToolbarFixture, {});

  for (const item of defaultButtons) {
    await expect
      .element(screen.getByRole('button', { name: item.label, exact: true }))
      .toBeInTheDocument();
  }
  // Plus the insert trigger.
  await expect
    .element(screen.getByRole('button', { name: 'Insert', exact: true }))
    .toBeInTheDocument();
});

test('renders the separators between the item groups', async () => {
  const screen = await render(ToolbarFixture, {});

  expect(screen.getByRole('separator').elements()).toHaveLength(2);
});

test('arrow keys, Home and End move focus within the one tab stop', async () => {
  const screen = await render(ToolbarFixture, {});

  const bold = screen.getByRole('button', { name: 'Bold' });
  await tabToToolbar();
  await expect.element(bold).toHaveFocus();

  await userEvent.keyboard('{ArrowRight}');
  await expect.element(screen.getByRole('button', { name: 'Italic' })).toHaveFocus();

  await userEvent.keyboard('{ArrowLeft}');
  await expect.element(bold).toHaveFocus();

  await userEvent.keyboard('{End}');
  await expect.element(screen.getByRole('button', { name: 'Insert', exact: true })).toHaveFocus();

  await userEvent.keyboard('{Home}');
  await expect.element(bold).toHaveFocus();
});

test('a separator is not a stop for the keyboard', async () => {
  const screen = await render(ToolbarFixture, {});

  // `Link` is the eighth item and the last before the first separator; one
  // more ArrowRight must land on `P`, the first item after it.
  await tabToToolbar();
  await userEvent.keyboard('{ArrowRight}'.repeat(7));
  await expect.element(screen.getByRole('button', { name: 'Link' })).toHaveFocus();

  await userEvent.keyboard('{ArrowRight}');
  await expect.element(screen.getByRole('button', { name: 'P', exact: true })).toHaveFocus();
});

test('a toggle reports its state through aria-pressed, and clicking it flips it', async () => {
  const screen = await render(ToolbarFixture, {});

  await typeInEditor('Sedge');
  await selectAll();

  const bold = screen.getByRole('button', { name: 'Bold' });
  await expect.element(bold).toHaveAttribute('aria-pressed', 'false');

  await bold.click();
  await expect.element(bold).toHaveAttribute('aria-pressed', 'true');
  expect(proseMirror().element().querySelector('strong')).not.toBeNull();

  await bold.click();
  await expect.element(bold).toHaveAttribute('aria-pressed', 'false');
});

test('an action item claims no pressed state', async () => {
  const screen = await render(ToolbarFixture, {});

  const rule = screen.getByRole('button', { name: 'Rule' }).element();
  expect(rule.getAttribute('aria-pressed')).toBeNull();
});

test('`isEnabled` renders a disabled button, which the arrow keys skip', async () => {
  const screen = await render(ToolbarFixture, {
    items: [
      { id: 'one', label: 'One', run: () => undefined },
      { id: 'two', label: 'Two', isEnabled: () => false, run: () => undefined },
      { id: 'three', label: 'Three', run: () => undefined },
    ],
  });

  await expect.element(screen.getByRole('button', { name: 'Two' })).toBeDisabled();

  await tabToToolbar();
  await expect.element(screen.getByRole('button', { name: 'One' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  await expect.element(screen.getByRole('button', { name: 'Three' })).toHaveFocus();
});

test('a run leaves focus in the document, so typing continues', async () => {
  const screen = await render(ToolbarFixture, {});

  await typeInEditor('Loam');
  await screen.getByRole('button', { name: 'H2' }).click();

  await expect.element(proseMirror()).toHaveFocus();
});

test('the insert button opens a menu of the slash commands, and Escape closes it', async () => {
  const screen = await render(ToolbarFixture, { insertMenuLabel: 'Insert a block' });

  const trigger = screen.getByRole('button', { name: 'Insert', exact: true });
  await expect.element(trigger).toHaveAttribute('aria-haspopup', 'menu');
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');

  await trigger.click();

  await expect.element(screen.getByRole('menu')).toHaveAccessibleName('Insert a block');
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect
    .element(screen.getByRole('menuitem', { name: 'Horizontal Rule' }))
    .toBeInTheDocument();

  await userEvent.keyboard('{Escape}');

  expect(screen.getByRole('menu').elements()).toHaveLength(0);
  await expect.element(trigger).toHaveFocus();
});

test('choosing "Heading 2" turns the block into a heading', async () => {
  const screen = await render(ToolbarFixture, {});

  await typeInEditor('Mulch');
  await screen.getByRole('button', { name: 'Insert', exact: true }).click();
  await screen.getByRole('menuitem', { name: 'Heading 2' }).click();

  await expect.element(proseMirror()).toHaveTextContent('Mulch');
  expect(proseMirror().element().querySelector('h2')?.textContent).toBe('Mulch');
});

test('the link item opens the link dialog, seeded from the selection', async () => {
  const screen = await render(ToolbarFixture, {});

  await typeInEditor('Anchor');
  await selectAll();
  await screen.getByRole('button', { name: 'Link' }).click();

  const dialog = screen.getByRole('dialog');
  await expect.element(dialog).toHaveAccessibleName('Link');

  await screen.getByLabelText('URL').fill('https://example.com/bed');
  await screen.getByRole('button', { name: 'Apply' }).click();

  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
  const anchor = proseMirror().element().querySelector('a');
  expect(anchor?.getAttribute('href')).toBe('https://example.com/bed');

  // Re-opening on the same selection seeds the field from the mark.
  await screen.getByRole('button', { name: 'Link' }).click();
  await expect.element(screen.getByLabelText('URL')).toHaveValue('https://example.com/bed');

  await screen.getByRole('button', { name: 'Remove link' }).click();
  expect(proseMirror().element().querySelector('a')).toBeNull();
});

test('the image item opens the image dialog and inserts what it accepts', async () => {
  const screen = await render(ToolbarFixture, {});

  await typeInEditor('Bed');
  await screen.getByRole('button', { name: 'Image' }).click();

  const dialog = screen.getByRole('dialog');
  await expect.element(dialog).toHaveAccessibleName('Image');
  await screen.getByLabelText('Image URL').fill('https://example.com/leaf.png');
  // Scoped to the dialog: the toolbar's insert trigger has the same name.
  await dialog.getByRole('button', { name: 'Insert', exact: true }).click();

  expect(proseMirror().element().querySelector('img')?.getAttribute('src')).toBe(
    'https://example.com/leaf.png',
  );
});

test('spreads native attributes on the toolbar, merges `class`, and `label` keeps the name', async () => {
  const screen = await render(ToolbarFixture, {
    label: 'Note toolbar',
    attributes: {
      class: 'sticky',
      id: 'note-toolbar',
      'data-surface': 'note',
      'aria-describedby': 'note-toolbar-hint',
    },
  });

  const toolbar = screen.getByRole('toolbar');
  await expect.element(toolbar).toHaveAttribute('id', 'note-toolbar');
  await expect.element(toolbar).toHaveAttribute('data-surface', 'note');
  await expect.element(toolbar).toHaveAttribute('aria-describedby', 'note-toolbar-hint');
  await expect.element(toolbar).toHaveAccessibleName('Note toolbar');
  await expect.element(toolbar).toHaveClass('sticky', 'flex', 'border');
});

test('`label` owns the accessible name: `aria-label` / `aria-labelledby` are no props, and lose at runtime', async () => {
  // The type half: neither is a prop. `svelte-check` runs over `tests/`, so
  // `vp run check` fails if either directive goes unused — that is, if the
  // props type ever accepts the attribute again.
  const withAriaLabel: ComponentProps<typeof BlockToolbar> = {
    // @ts-expect-error -- `label` owns the toolbar's accessible name.
    'aria-label': 'Ignored',
  };
  const withAriaLabelledBy: ComponentProps<typeof BlockToolbar> = {
    // @ts-expect-error -- `label` owns the toolbar's accessible name.
    'aria-labelledby': 'toolbar-hijack',
  };
  labellingElement('toolbar-hijack', 'Hijacked');

  // The runtime half: spread before the component's own attributes, an
  // untyped caller's `aria-label` is overridden and its `aria-labelledby`
  // cleared.
  const screen = await render(ToolbarFixture, {
    label: 'Note toolbar',
    attributes: { ...withAriaLabel, ...withAriaLabelledBy, id: 'note-toolbar' },
  });

  const toolbar = screen.getByRole('toolbar');
  await expect.element(toolbar).toHaveAttribute('id', 'note-toolbar');
  await expect.element(toolbar).toHaveAccessibleName('Note toolbar');
  await expect.element(toolbar).toHaveAttribute('aria-label', 'Note toolbar');
  await expect.element(toolbar).not.toHaveAttribute('aria-labelledby');
});
