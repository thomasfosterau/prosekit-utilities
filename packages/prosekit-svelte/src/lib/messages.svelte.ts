/**
 * The optional per-render-site copy override.
 *
 * Every string this package renders is already a prop with an English
 * default, so an application can translate one call site by passing props.
 * {@link setEditorMessages} is the other half: it changes those *defaults*
 * for one subtree, so an application that mounts the editor from several
 * places wires its catalogue once per place instead of threading twenty
 * props through each.
 *
 * It is deliberately set **per render site** — from the component that
 * mounts an editor — and never from a root layout. Wiring it high in the
 * tree means importing this package's barrel there, and `Editor.svelte`'s
 * bare `prosekit/basic/*.css` imports would then land in every page's shared
 * chunk along with the ProseKit runtime they pull behind them. That is the
 * one bundle boundary this package exists to hold (the app repos measured it
 * and enforce it with bundle-boundary tests; PERF-BUNDLE-001).
 *
 * When no provider is mounted — Storybook, a test, an application that never
 * wires it — {@link getEditorMessages} returns {@link defaultEditorMessages}.
 * The missing-provider case is the documented normal case, not an error:
 * the editor is silently un-translated, never broken.
 *
 * @module
 */

import { getContext, setContext } from 'svelte';

/**
 * Every user-facing string this package can render, as one flat record of
 * plain strings.
 *
 * Flat and plain on purpose. Nested groups would have to be merged
 * recursively for a partial override to work, and message *functions* (what
 * the applications this package was extracted from used) force every call
 * site to remember the parentheses. A string is what a Svelte prop wants.
 *
 * The first block is the component label props; the rest are the labels of
 * the items {@link createDefaultToolbarItems} and
 * {@link createDefaultSlashCommands} build, which are data rather than
 * markup and so are the only way to translate them.
 */
export interface EditorMessages {
  /** Accessible name of `BlockToolbar`'s `role="toolbar"`. */
  readonly toolbarLabel: string;
  /** Visible label and accessible name of the insert-menu trigger. */
  readonly insertLabel: string;
  /** Accessible name of the open insert menu. */
  readonly insertMenuLabel: string;

  /** `LinkDialog`'s heading — the dialog's accessible name. */
  readonly linkDialogTitle: string;
  /** Label of `LinkDialog`'s URL field. */
  readonly linkHrefLabel: string;
  /** Label of `LinkDialog`'s optional title field. */
  readonly linkTitleLabel: string;
  /** `LinkDialog`'s submit button. */
  readonly linkSubmitLabel: string;
  /** `LinkDialog`'s remove-the-link button. */
  readonly linkRemoveLabel: string;
  /** `LinkDialog`'s cancel button. */
  readonly linkCancelLabel: string;
  /** Accessible name of `LinkDialog`'s corner close button. */
  readonly linkCloseLabel: string;
  /** Shown in a `role="alert"` when the URL fails `isSafeHref`. */
  readonly linkInvalidHrefMessage: string;

  /** `ImageDialog`'s heading — the dialog's accessible name. */
  readonly imageDialogTitle: string;
  /** Label of `ImageDialog`'s source field. */
  readonly imageSrcLabel: string;
  /** `ImageDialog`'s submit button. */
  readonly imageSubmitLabel: string;
  /** `ImageDialog`'s cancel button. */
  readonly imageCancelLabel: string;
  /** Accessible name of `ImageDialog`'s corner close button. */
  readonly imageCloseLabel: string;
  /** Shown in a `role="alert"` when the source fails `isSafeHref`. */
  readonly imageInvalidSrcMessage: string;

  /** Default toolbar item: toggle the `bold` mark. */
  readonly bold: string;
  /** Default toolbar item: toggle the `italic` mark. */
  readonly italic: string;
  /** Default toolbar item: toggle the `underline` mark. */
  readonly underline: string;
  /** Default toolbar item: toggle the `strike` mark. */
  readonly strike: string;
  /** Default toolbar item: toggle the `highlight` mark. */
  readonly highlight: string;
  /** Default toolbar item: toggle the `subscript` mark. */
  readonly subscript: string;
  /** Default toolbar item: toggle the `superscript` mark. */
  readonly superscript: string;
  /** Default toolbar item: open `LinkDialog`. */
  readonly link: string;
  /** Default toolbar item: set the block to a paragraph. */
  readonly paragraph: string;
  /** Default toolbar item: toggle a level-2 heading. */
  readonly heading2: string;
  /** Default toolbar item: toggle a blockquote. */
  readonly quote: string;
  /** Default toolbar item: toggle a bullet list. */
  readonly bullets: string;
  /** Default toolbar item: toggle an ordered list. */
  readonly numbered: string;
  /** Default toolbar item: toggle a code block. */
  readonly codeBlock: string;
  /** Default toolbar item: insert a horizontal rule. */
  readonly rule: string;
  /** Default toolbar item: insert a 3×3 table. */
  readonly table: string;
  /** Default toolbar item: open `ImageDialog`. */
  readonly image: string;
  /** Default toolbar item: undo. */
  readonly undo: string;
  /** Default toolbar item: redo. */
  readonly redo: string;

  /** Default insert-menu command: set the block to a paragraph. */
  readonly slashParagraph: string;
  /** Default insert-menu command: toggle a level-2 heading. */
  readonly slashHeading2: string;
  /** Default insert-menu command: toggle a blockquote. */
  readonly slashBlockquote: string;
  /** Default insert-menu command: toggle a bullet list. */
  readonly slashBulletList: string;
  /** Default insert-menu command: toggle an ordered list. */
  readonly slashOrderedList: string;
  /** Default insert-menu command: toggle a task list. */
  readonly slashTodoList: string;
  /** Default insert-menu command: toggle a code block. */
  readonly slashCodeBlock: string;
  /** Default insert-menu command: insert a 3×3 table. */
  readonly slashTable: string;
  /** Default insert-menu command: open `ImageDialog`. */
  readonly slashImage: string;
  /** Default insert-menu command: insert a horizontal rule. */
  readonly slashHorizontalRule: string;
}

/**
 * The English copy every prop falls back to.
 *
 * The item labels are the ones the applications this package was extracted
 * from shipped, abbreviations included (`P`, `H2`, `Sub`, `Sup`): the
 * default toolbar draws no icons, so an item's label is both its visible
 * text and its accessible name, and changing them would change what those
 * applications' users read. An application that wants longer names passes
 * its own `items`, or overrides these keys.
 */
export const defaultEditorMessages: EditorMessages = {
  toolbarLabel: 'Editor toolbar',
  insertLabel: 'Insert',
  insertMenuLabel: 'Insert block',

  linkDialogTitle: 'Link',
  linkHrefLabel: 'URL',
  linkTitleLabel: 'Title (optional)',
  linkSubmitLabel: 'Apply',
  linkRemoveLabel: 'Remove link',
  linkCancelLabel: 'Cancel',
  linkCloseLabel: 'Close',
  linkInvalidHrefMessage: 'Enter an http, https or mailto URL.',

  imageDialogTitle: 'Image',
  imageSrcLabel: 'Image URL',
  imageSubmitLabel: 'Insert',
  imageCancelLabel: 'Cancel',
  imageCloseLabel: 'Close',
  imageInvalidSrcMessage: 'Enter an http, https or mailto URL.',

  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strike',
  highlight: 'Highlight',
  subscript: 'Sub',
  superscript: 'Sup',
  link: 'Link',
  paragraph: 'P',
  heading2: 'H2',
  quote: 'Quote',
  bullets: 'Bullets',
  numbered: 'Numbered',
  codeBlock: 'Code',
  rule: 'Rule',
  table: 'Table',
  image: 'Image',
  undo: 'Undo',
  redo: 'Redo',

  slashParagraph: 'Paragraph',
  slashHeading2: 'Heading 2',
  slashBlockquote: 'Blockquote',
  slashBulletList: 'Bullet List',
  slashOrderedList: 'Ordered List',
  slashTodoList: 'Todo List',
  slashCodeBlock: 'Code Block',
  slashTable: 'Table',
  slashImage: 'Image',
  slashHorizontalRule: 'Horizontal Rule',
};

/**
 * The context key.
 *
 * `Symbol.for` rather than `Symbol()`: a registry symbol is the same value
 * in two copies of this module, which is what keeps a duplicated bundle from
 * silently falling back to English on one half of the tree.
 */
const MESSAGES_KEY = Symbol.for('@thomasfosterau/prosekit-svelte/messages');

/**
 * Provides the copy for this subtree, merged over
 * {@link defaultEditorMessages}.
 *
 * Call it during the initialisation of the component that mounts an editor —
 * Svelte's `setContext` is only legal there — and pass only the keys being
 * translated; everything else keeps its English default.
 */
export function setEditorMessages(messages: Partial<EditorMessages>): void {
  setContext<EditorMessages>(MESSAGES_KEY, { ...defaultEditorMessages, ...messages });
}

/**
 * Reads the copy for this subtree, or {@link defaultEditorMessages} when no
 * provider is mounted.
 *
 * Call it once in a component's `<script>` and spend the result in the
 * `$props()` defaults (`label = messages.toolbarLabel`), so a caller's own
 * prop still wins over the context.
 */
export function getEditorMessages(): EditorMessages {
  return getContext<EditorMessages | undefined>(MESSAGES_KEY) ?? defaultEditorMessages;
}
