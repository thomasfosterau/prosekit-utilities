/**
 * `ImageDialog` — `LinkDialog`'s contract, on the one field ProseKit's stock
 * `image` node can actually hold.
 */

import { expect, test, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser';
import { render } from 'vitest-browser-svelte';
import ImageDialog from '../src/lib/toolbar/ImageDialog.svelte';

test('open, it is a modal dialog named by its title, with focus inside it', async () => {
  const screen = await render(ImageDialog, { open: true, onSubmit: () => undefined });

  const dialog = screen.getByRole('dialog');
  await expect.element(dialog).toHaveAccessibleName('Image');
  expect(dialog.element().getAttribute('aria-modal')).toBe('true');
  // Polled: bits-ui moves focus into the content a tick after it mounts.
  await expect.poll(() => dialog.element().contains(document.activeElement)).toBe(true);
});

test('Tab cycles within the dialog and never escapes it', async () => {
  const screen = await render(ImageDialog, { open: true, onSubmit: () => undefined });
  const dialog = screen.getByRole('dialog').element();

  for (let press = 0; press < 6; press += 1) {
    await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  }
});

test('Escape closes it', async () => {
  const screen = await render(ImageDialog, { open: true, onSubmit: () => undefined });

  await userEvent.keyboard('{Escape}');

  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
});

test('a data: URL is refused in a live region and nothing is submitted', async () => {
  const onSubmit = vi.fn();
  const screen = await render(ImageDialog, { open: true, onSubmit });

  await screen.getByLabelText('Image URL').fill('data:text/html;base64,PHN2Zz4=');
  await screen.getByRole('button', { name: 'Insert' }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Enter an http, https or mailto URL.');
  expect(onSubmit).not.toHaveBeenCalled();
  await expect.element(screen.getByRole('dialog')).toBeInTheDocument();
});

test('a safe URL submits and closes', async () => {
  const onSubmit = vi.fn();
  const screen = await render(ImageDialog, { open: true, onSubmit });

  await screen.getByLabelText('Image URL').fill('  https://example.com/leaf.png ');
  await screen.getByRole('button', { name: 'Insert' }).click();

  expect(onSubmit).toHaveBeenCalledWith({ src: 'https://example.com/leaf.png' });
  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
});

test('Enter in the field submits', async () => {
  const onSubmit = vi.fn();
  const screen = await render(ImageDialog, { open: true, onSubmit });

  await screen.getByLabelText('Image URL').click();
  await userEvent.keyboard('/uploads/leaf.png{Enter}');

  expect(onSubmit).toHaveBeenCalledWith({ src: '/uploads/leaf.png' });
});

test('cancel closes without submitting', async () => {
  const onSubmit = vi.fn();
  const screen = await render(ImageDialog, { open: true, onSubmit });

  await screen.getByLabelText('Image URL').fill('https://example.com/leaf.png');
  await screen.getByRole('button', { name: 'Cancel' }).click();

  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog').elements()).toHaveLength(0);
});

test('every label is a prop', async () => {
  const screen = await render(ImageDialog, {
    open: true,
    onSubmit: () => undefined,
    titleLabel: 'Bild',
    srcLabel: 'Bildadresse',
    submitLabel: 'Einfügen',
    cancelLabel: 'Abbrechen',
    closeLabel: 'Schließen',
    invalidSrcMessage: 'Ungültige Adresse.',
  });

  await expect.element(screen.getByRole('dialog')).toHaveAccessibleName('Bild');
  await screen.getByLabelText('Bildadresse').fill('javascript:alert(1)');
  await screen.getByRole('button', { name: 'Einfügen' }).click();
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Ungültige Adresse.');

  for (const name of ['Abbrechen', 'Schließen']) {
    await expect.element(screen.getByRole('button', { name })).toBeInTheDocument();
  }
});

test('spreads native attributes on the dialog element, merges `class`, and keeps the modal wiring', async () => {
  const screen = await render(ImageDialog, {
    open: true,
    onSubmit: () => undefined,
    class: 'max-w-lg',
    id: 'image-dialog',
    'data-surface': 'image',
    'aria-describedby': 'image-dialog-hint',
    // Competing values for what the modal contract owns: each one loses.
    role: 'region',
    'aria-modal': 'false',
    'aria-labelledby': 'ignored',
    'aria-label': 'Ignored',
  });

  const dialog = screen.getByRole('dialog');
  await expect.element(dialog).toHaveAttribute('id', 'image-dialog');
  await expect.element(dialog).toHaveAttribute('data-surface', 'image');
  // No `Dialog.Description` here, so the caller's description is the one.
  await expect.element(dialog).toHaveAttribute('aria-describedby', 'image-dialog-hint');
  await expect.element(dialog).toHaveAttribute('aria-modal', 'true');
  await expect.element(dialog).toHaveAccessibleName('Image');
  expect(dialog.element().getAttribute('aria-labelledby')).not.toBe('ignored');
  await expect.element(dialog).toHaveClass('max-w-lg', 'modal-box');
});
