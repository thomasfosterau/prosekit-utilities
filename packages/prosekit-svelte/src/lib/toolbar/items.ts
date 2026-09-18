/**
 * The toolbar's data model, and the default sets built from it.
 *
 * `BlockToolbar` renders a list rather than a hard-coded row of buttons.
 * The applications this package was extracted from hard-coded theirs, and
 * the cost showed: one of them carried five buttons for node types its
 * grammar no longer had, and neither could add an item without editing the
 * component. Here an item is a value — an application appends its own,
 * reorders, drops one, or passes a list of its own making.
 *
 * An item's `run` receives a {@link ToolbarRunContext} rather than the
 * editor alone, because two of the default items open a dialog the toolbar
 * owns. `dialogs.link()` / `dialogs.image()` are how an item asks for one
 * without importing it.
 *
 * @module
 */

import type { CommandAction, Editor, MarkAction, NodeAction } from 'prosekit/core';
import { defaultEditorMessages, type EditorMessages } from '../messages.svelte.ts';

/**
 * The editor as a toolbar item sees it: any grammar, with `commands`,
 * `nodes` and `marks` read by name.
 *
 * `Editor<any>` cannot be used directly. ProseKit derives those three from
 * the extension's own typing, and the derivation collapses to `never` for
 * `any` — so `editor.commands.toggleBold()` in an application's own item
 * would not compile at all. Widening the three back to records is what makes
 * a set of items generic over the grammar writable; a real `Editor<E>` is
 * assignable to it, and an item that names a command the grammar lacks gets
 * `undefined` rather than a type error, which is the honest outcome.
 */
export type ToolbarEditor = Omit<Editor<any>, 'commands' | 'marks' | 'nodes'> & {
  readonly commands: Record<string, CommandAction>;
  readonly marks: Record<string, MarkAction>;
  readonly nodes: Record<string, NodeAction>;
};

/**
 * What a toolbar item's `run` is handed.
 *
 * `editor` is the live editor from the enclosing `<ProseKit>`; `dialogs`
 * opens one of the toolbar's own dialogs. Calling a dialog opener also tells
 * the toolbar not to pull focus back into the document, which would take it
 * straight off the dialog that is about to open.
 */
export interface ToolbarRunContext {
  /** The editor the toolbar is attached to. */
  readonly editor: ToolbarEditor;
  /** The dialogs the toolbar renders, for items that need one. */
  readonly dialogs: {
    /** Opens the link dialog, seeded from the selection's link mark. */
    readonly link: () => void;
    /** Opens the image dialog. */
    readonly image: () => void;
  };
}

/**
 * One button of {@link BlockToolbar}.
 *
 * `kind: 'toggle'` is what makes the button carry `aria-pressed`; an action
 * (insert a rule, open a dialog, undo) has no pressed state and must not
 * claim one. `isActive` is read on every editor update, so it must be cheap
 * and must not throw when the schema lacks the node or mark it asks about.
 */
export interface ToolbarItem {
  /** Stable key for the `{#each}` and for an application replacing an item. */
  readonly id: string;
  /** Visible text and accessible name. */
  readonly label: string;
  /** `'toggle'` renders `aria-pressed`; `'action'` (the default) does not. */
  readonly kind?: ('toggle' | 'action') | undefined;
  /** Whether the item's state is on. Only read for `kind: 'toggle'`. */
  readonly isActive?: ((editor: ToolbarEditor) => boolean) | undefined;
  /** Whether the item can be used. `false` renders a `disabled` button. */
  readonly isEnabled?: ((editor: ToolbarEditor) => boolean) | undefined;
  /** What the button does. */
  readonly run: (context: ToolbarRunContext) => void;
}

/**
 * A divider between groups of items, allowed anywhere in `items`.
 *
 * It renders as `role="separator"` and is skipped by the toolbar's arrow-key
 * navigation — a separator is a landmark for the eye, not a stop for the
 * keyboard.
 */
export interface ToolbarSeparator {
  /** Stable key for the `{#each}`. */
  readonly id: string;
  /** The discriminant. */
  readonly separator: true;
}

/** One entry of the insert menu. */
export interface SlashCommand {
  /** Stable key for the `{#each}`. */
  readonly id: string;
  /** Visible text and accessible name. */
  readonly label: string;
  /** What choosing the entry does. */
  readonly run: (context: ToolbarRunContext) => void;
}

/** Narrows an `items` entry to the separator arm. */
export function isToolbarSeparator(
  entry: ToolbarItem | ToolbarSeparator,
): entry is ToolbarSeparator {
  return 'separator' in entry;
}

/**
 * Reads a mark's active state without assuming the schema has it.
 *
 * The default item set covers `defineBlockDocumentExtension()`'s grammar,
 * but an application may pass a narrower extension and keep the default
 * items; a missing mark then makes the button inert rather than throwing on
 * every editor update.
 */
const isMarkActive = (editor: ToolbarEditor, name: string): boolean =>
  editor.marks[name]?.isActive() ?? false;

/** {@link isMarkActive} for a node type, optionally matching `attrs`. */
const isNodeActive = (
  editor: ToolbarEditor,
  name: string,
  attrs?: Record<string, unknown>,
): boolean => editor.nodes[name]?.isActive(attrs) ?? false;

/**
 * Toggles one of the three marks that have no toggle command of their own.
 *
 * `highlight`, `subscript` and `superscript` are the applications' own mark
 * specs, and ProseKit's generic `addMark` is the only command that reaches
 * them. `addMark` alone can never turn a mark off, which is exactly the lie
 * `aria-pressed` would then tell, so the item reads its own `isActive` and
 * picks `removeMark` when the mark is on.
 */
const toggleGenericMark = (editor: ToolbarEditor, type: string): void => {
  if (isMarkActive(editor, type)) editor.commands['removeMark']?.({ type });
  else editor.commands['addMark']?.({ type });
};

/**
 * The default toolbar: the nineteen items the applications shipped, in their
 * order, with two separators marking the mark / block / history groups.
 *
 * The twentieth control those toolbars carried was a button that toggled an
 * ad-hoc "slash" panel; it is the insert menu now, and `BlockToolbar`
 * renders it itself from {@link createDefaultSlashCommands}.
 *
 * Every `run` goes through the editor's own `commands`, `marks` and `nodes`,
 * so the set works against any extension that registers those node and mark
 * types and quietly does nothing against one that does not.
 *
 * @param messages - Labels to use instead of the English defaults. A partial
 *   record; unlisted keys keep their default.
 */
export function createDefaultToolbarItems(
  messages?: Partial<EditorMessages> | undefined,
): ReadonlyArray<ToolbarItem | ToolbarSeparator> {
  const m: EditorMessages = { ...defaultEditorMessages, ...messages };

  return [
    {
      id: 'bold',
      label: m.bold,
      kind: 'toggle',
      isActive: (editor) => isMarkActive(editor, 'bold'),
      run: ({ editor }) => void editor.commands['toggleBold']?.(),
    },
    {
      id: 'italic',
      label: m.italic,
      kind: 'toggle',
      isActive: (editor) => isMarkActive(editor, 'italic'),
      run: ({ editor }) => void editor.commands['toggleItalic']?.(),
    },
    {
      id: 'underline',
      label: m.underline,
      kind: 'toggle',
      isActive: (editor) => isMarkActive(editor, 'underline'),
      run: ({ editor }) => void editor.commands['toggleUnderline']?.(),
    },
    {
      id: 'strike',
      label: m.strike,
      kind: 'toggle',
      isActive: (editor) => isMarkActive(editor, 'strike'),
      run: ({ editor }) => void editor.commands['toggleStrike']?.(),
    },
    {
      id: 'highlight',
      label: m.highlight,
      kind: 'toggle',
      isActive: (editor) => isMarkActive(editor, 'highlight'),
      run: ({ editor }) => toggleGenericMark(editor, 'highlight'),
    },
    {
      id: 'subscript',
      label: m.subscript,
      kind: 'toggle',
      isActive: (editor) => isMarkActive(editor, 'subscript'),
      run: ({ editor }) => toggleGenericMark(editor, 'subscript'),
    },
    {
      id: 'superscript',
      label: m.superscript,
      kind: 'toggle',
      isActive: (editor) => isMarkActive(editor, 'superscript'),
      run: ({ editor }) => toggleGenericMark(editor, 'superscript'),
    },
    {
      id: 'link',
      label: m.link,
      kind: 'action',
      run: ({ dialogs }) => dialogs.link(),
    },

    { id: 'marks-blocks', separator: true },

    {
      id: 'paragraph',
      // An action, not a toggle: `setParagraph` only ever sets, so a pressed
      // state that can never be un-pressed would be a claim `aria-pressed`
      // makes out loud and the button cannot honour. The eleven items around
      // it each have a real toggle command.
      label: m.paragraph,
      kind: 'action',
      run: ({ editor }) => void editor.commands['setParagraph']?.(),
    },
    {
      id: 'heading2',
      label: m.heading2,
      kind: 'toggle',
      isActive: (editor) => isNodeActive(editor, 'heading', { level: 2 }),
      run: ({ editor }) => void editor.commands['toggleHeading']?.({ level: 2 }),
    },
    {
      id: 'quote',
      label: m.quote,
      kind: 'toggle',
      isActive: (editor) => isNodeActive(editor, 'blockquote'),
      run: ({ editor }) => void editor.commands['toggleBlockquote']?.(),
    },
    {
      id: 'bullets',
      label: m.bullets,
      kind: 'toggle',
      isActive: (editor) => isNodeActive(editor, 'list', { kind: 'bullet' }),
      run: ({ editor }) => void editor.commands['toggleList']?.({ kind: 'bullet' }),
    },
    {
      id: 'numbered',
      label: m.numbered,
      kind: 'toggle',
      isActive: (editor) => isNodeActive(editor, 'list', { kind: 'ordered' }),
      run: ({ editor }) => void editor.commands['toggleList']?.({ kind: 'ordered' }),
    },
    {
      id: 'code-block',
      label: m.codeBlock,
      kind: 'toggle',
      isActive: (editor) => isNodeActive(editor, 'codeBlock'),
      run: ({ editor }) => void editor.commands['toggleCodeBlock']?.(),
    },
    {
      id: 'rule',
      label: m.rule,
      kind: 'action',
      run: ({ editor }) => void editor.commands['insertHorizontalRule']?.(),
    },
    {
      id: 'table',
      label: m.table,
      kind: 'action',
      run: ({ editor }) => void editor.commands['insertTable']?.({ row: 3, col: 3 }),
    },
    {
      id: 'image',
      label: m.image,
      kind: 'action',
      run: ({ dialogs }) => dialogs.image(),
    },

    { id: 'blocks-history', separator: true },

    {
      id: 'undo',
      label: m.undo,
      kind: 'action',
      run: ({ editor }) => void editor.commands['undo']?.(),
    },
    {
      id: 'redo',
      label: m.redo,
      kind: 'action',
      run: ({ editor }) => void editor.commands['redo']?.(),
    },
  ];
}

/**
 * The default insert menu: the ten entries the applications shipped, in
 * their order.
 *
 * @param messages - Labels to use instead of the English defaults. A partial
 *   record; unlisted keys keep their default.
 */
export function createDefaultSlashCommands(
  messages?: Partial<EditorMessages> | undefined,
): ReadonlyArray<SlashCommand> {
  const m: EditorMessages = { ...defaultEditorMessages, ...messages };

  return [
    {
      id: 'paragraph',
      label: m.slashParagraph,
      run: ({ editor }) => void editor.commands['setParagraph']?.(),
    },
    {
      id: 'heading2',
      label: m.slashHeading2,
      run: ({ editor }) => void editor.commands['toggleHeading']?.({ level: 2 }),
    },
    {
      id: 'blockquote',
      label: m.slashBlockquote,
      run: ({ editor }) => void editor.commands['toggleBlockquote']?.(),
    },
    {
      id: 'bullet-list',
      label: m.slashBulletList,
      run: ({ editor }) => void editor.commands['toggleList']?.({ kind: 'bullet' }),
    },
    {
      id: 'ordered-list',
      label: m.slashOrderedList,
      run: ({ editor }) => void editor.commands['toggleList']?.({ kind: 'ordered' }),
    },
    {
      id: 'todo-list',
      label: m.slashTodoList,
      run: ({ editor }) => void editor.commands['toggleList']?.({ kind: 'task' }),
    },
    {
      id: 'code-block',
      label: m.slashCodeBlock,
      run: ({ editor }) => void editor.commands['toggleCodeBlock']?.(),
    },
    {
      id: 'table',
      label: m.slashTable,
      run: ({ editor }) => void editor.commands['insertTable']?.({ row: 3, col: 3 }),
    },
    {
      id: 'image',
      label: m.slashImage,
      run: ({ dialogs }) => dialogs.image(),
    },
    {
      id: 'horizontal-rule',
      label: m.slashHorizontalRule,
      run: ({ editor }) => void editor.commands['insertHorizontalRule']?.(),
    },
  ];
}
