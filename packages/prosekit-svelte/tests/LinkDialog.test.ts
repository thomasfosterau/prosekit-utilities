/**
 * `LinkDialog` — the modal that replaced a `window.prompt` chain.
 *
 * What is asserted is the whole reason it is a dialog: it has an accessible
 * name, focus is inside it and stays there, Escape gets out, a `javascript:`
 * URL is refused out loud in a `role="alert"` instead of silently becoming
 * an anchor, and Enter in the field submits.
 */

import { expect, test, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser';
import { render } from 'vitest-browser-svelte';
import LinkDialog from '../src/lib/toolbar/LinkDialog.svelte';

test('open, it is a modal dialog named by its title, with focus inside it', async () => {
  const screen = await render(LinkDialog, { open: true, onSubmit: () => undefined });

  const dialog = screen.getByRole('dialog');
  await expect.element(dialog).toHaveAccessibleName('Link');
  expect(dialog.element().getAttribute('aria-modal')).toBe('true');
  // Polled: bits-ui moves focus into the content a tick after it mounts.
  await expect.poll(() => dialog.element().contains(document.activeElement)).toBe(true);

  // The name is a relationship, not a copy of the text.
  const labelledBy = dialog.element().getAttribute('aria-labelledby');
  expect(document.getElementById(labelledBy ?? '')).toHaveTextContent('Link');
});

test('Tab cycles within the dialog and never escapes it', async () => {
  const screen = await render(LinkDialog, { open: true, onSubmit: () => undefined });
  const dialog = screen.getByRole('dialog').element();

  for (let press = 0; press < 7; press += 1) {
    await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  }
});

test('Escape closes it', async () => {
  const screen = await render(LinkDialog, { open: true, onSubmit: () => undefined });

  await userEvent.keyboard('{Escape}');

  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
});

test('a javascript: URL is refused in a live region and nothing is submitted', async () => {
  const onSubmit = vi.fn();
  const screen = await render(LinkDialog, { open: true, onSubmit });

  await screen.getByLabelText('URL').fill('javascript:alert(1)');
  await screen.getByRole('button', { name: 'Apply' }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Enter an http, https or mailto URL.');
  expect(onSubmit).not.toHaveBeenCalled();
  await expect.element(screen.getByRole('dialog')).toBeInTheDocument();

  // The field points at the message, so it is announced with the field too.
  const field = screen.getByLabelText('URL').element();
  expect(field.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(field.getAttribute('aria-describedby') ?? '')).toHaveTextContent(
    'Enter an http, https or mailto URL.',
  );
});

test('a safe URL submits and closes, trimming and dropping an empty title', async () => {
  const onSubmit = vi.fn();
  const screen = await render(LinkDialog, { open: true, onSubmit });

  await screen.getByLabelText('URL').fill('  https://example.com/bed  ');
  await screen.getByRole('button', { name: 'Apply' }).click();

  expect(onSubmit).toHaveBeenCalledWith({ href: 'https://example.com/bed', title: null });
  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
});

test('Enter in the URL field submits', async () => {
  const onSubmit = vi.fn();
  const screen = await render(LinkDialog, { open: true, onSubmit });

  await screen.getByLabelText('URL').click();
  await userEvent.keyboard('https://example.com/seed{Enter}');

  expect(onSubmit).toHaveBeenCalledWith({ href: 'https://example.com/seed', title: null });
});

test('seeds from `href` and `title`, and carries the title through', async () => {
  const onSubmit = vi.fn();
  const screen = await render(LinkDialog, {
    open: true,
    href: 'https://example.com/old',
    title: 'The old bed',
    onSubmit,
  });

  await expect.element(screen.getByLabelText('URL')).toHaveValue('https://example.com/old');
  await expect.element(screen.getByLabelText('Title (optional)')).toHaveValue('The old bed');

  await screen.getByRole('button', { name: 'Apply' }).click();

  expect(onSubmit).toHaveBeenCalledWith({
    href: 'https://example.com/old',
    title: 'The old bed',
  });
});

test('the remove button is there only with `onRemove`, and closes the dialog', async () => {
  const onRemove = vi.fn();
  const withoutRemove = await render(LinkDialog, { open: true, onSubmit: () => undefined });
  expect(withoutRemove.getByRole('button', { name: 'Remove link' }).elements()).toHaveLength(0);
  await withoutRemove.unmount();

  const screen = await render(LinkDialog, { open: true, onSubmit: () => undefined, onRemove });
  await screen.getByRole('button', { name: 'Remove link' }).click();

  expect(onRemove).toHaveBeenCalledOnce();
  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
});

test('cancel closes without submitting', async () => {
  const onSubmit = vi.fn();
  const screen = await render(LinkDialog, { open: true, onSubmit });

  await screen.getByLabelText('URL').fill('https://example.com');
  await screen.getByRole('button', { name: 'Cancel' }).click();

  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
});

test('every label is a prop', async () => {
  const screen = await render(LinkDialog, {
    open: true,
    onSubmit: () => undefined,
    onRemove: () => undefined,
    titleLabel: 'Lien',
    hrefLabel: 'Adresse',
    linkTitleLabel: 'Titre',
    submitLabel: 'Appliquer',
    removeLabel: 'Retirer',
    cancelLabel: 'Annuler',
    closeLabel: 'Fermer',
  });

  await expect.element(screen.getByRole('dialog')).toHaveAccessibleName('Lien');
  await expect.element(screen.getByLabelText('Adresse')).toBeInTheDocument();
  await expect.element(screen.getByLabelText('Titre')).toBeInTheDocument();
  for (const name of ['Appliquer', 'Retirer', 'Annuler', 'Fermer']) {
    await expect.element(screen.getByRole('button', { name })).toBeInTheDocument();
  }
});

test('spreads native attributes on the dialog element, merges `class`, and keeps the modal wiring', async () => {
  const screen = await render(LinkDialog, {
    open: true,
    onSubmit: () => undefined,
    class: 'max-w-lg',
    id: 'link-dialog',
    'data-surface': 'link',
    'aria-describedby': 'link-dialog-hint',
    // Competing values for what the modal contract owns: each one loses.
    role: 'region',
    'aria-modal': 'false',
    'aria-labelledby': 'ignored',
    'aria-label': 'Ignored',
  });

  const dialog = screen.getByRole('dialog');
  await expect.element(dialog).toHaveAttribute('id', 'link-dialog');
  await expect.element(dialog).toHaveAttribute('data-surface', 'link');
  // No `Dialog.Description` here, so the caller's description is the one.
  await expect.element(dialog).toHaveAttribute('aria-describedby', 'link-dialog-hint');
  await expect.element(dialog).toHaveAttribute('aria-modal', 'true');
  await expect.element(dialog).toHaveAccessibleName('Link');
  expect(dialog.element().getAttribute('aria-labelledby')).not.toBe('ignored');
  await expect.element(dialog).toHaveClass('max-w-lg', 'modal-box');
});
