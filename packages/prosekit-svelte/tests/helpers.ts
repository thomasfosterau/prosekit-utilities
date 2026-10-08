/**
 * Shared helpers for the browser suite.
 *
 * @module
 */

import { onTestFinished } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

/**
 * Locates the mounted ProseMirror content node.
 *
 * Not `getByRole('textbox')`: HTML-AAM gives `contenteditable` no implicit
 * role, so the accessible-name queries this suite otherwise prefers cannot
 * reach it. `.ProseMirror[contenteditable]` is ProseMirror's own contract
 * and the only stable handle on it.
 */
export function proseMirror(): ReturnType<typeof page.elementLocator> {
  const element = document.querySelector('.ProseMirror[contenteditable]');
  if (element === null) throw new Error('no ProseMirror content node is mounted');
  return page.elementLocator(element);
}

/** Puts the caret in the document and types `text` with real key events. */
export async function typeInEditor(text: string): Promise<void> {
  await proseMirror().click();
  await userEvent.keyboard(text);
}

/** Reads the JSON a fixture rendered out of its `content` binding. */
export function boundContent(): unknown {
  const element = document.querySelector('[data-testid="content"]');
  const text = element?.textContent ?? '';
  return text.length === 0 ? undefined : JSON.parse(text);
}

/** Reads the value of the hidden form input `BlockEditor` / `InlineEditor` emit. */
export function hiddenInputValue(name: string): unknown {
  const input = document.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
  if (input === null) throw new Error(`no hidden input named ${name}`);
  return JSON.parse(input.value);
}

/**
 * Puts a `<span id={id}>` (or another `tag`) reading `text` in the document
 * for the rest of the test, so an `aria-labelledby` pointing at it names its
 * element `text`: a visible heading for `labelledBy`, or the proof that a
 * component's own label won over a caller's `aria-labelledby`.
 */
export function labellingElement(id: string, text: string, tag: 'span' | 'h2' = 'span'): void {
  const element = document.createElement(tag);
  element.id = id;
  element.textContent = text;
  document.body.append(element);
  onTestFinished(() => element.remove());
}
