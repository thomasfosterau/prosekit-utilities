/**
 * The two composite extensions an application starts from, and the editor
 * behaviour they share.
 *
 * Each preset takes `...extra` extensions and unions them in last, which is
 * how an opt-in node or mark joins a grammar:
 *
 * ```ts
 * const extension = () =>
 *   defineBlockDocumentExtension(defineMention(), defineFigure(), defineCitation());
 * ```
 *
 * The presets are deliberately not configurable beyond that. A grammar is a
 * wire contract: adding an extension widens what decodes, and an options bag
 * that could *remove* a stock node would silently narrow it for documents
 * already written. Composing a narrower grammar means calling `union` over
 * the node and mark definitions directly.
 *
 * @module
 */

import {
  defineBaseCommands,
  defineBaseKeymap,
  defineHistory,
  union,
  type Extension,
} from 'prosekit/core';
import { defineGapCursor } from 'prosekit/extensions/gap-cursor';
import { defineModClickPrevention } from 'prosekit/extensions/mod-click-prevention';
import { defineVirtualSelection } from 'prosekit/extensions/virtual-selection';
import { defineStandardMarks } from './marks.ts';
import {
  defineBlockquote,
  defineCodeBlock,
  defineDoc,
  defineHardBreak,
  defineHeading,
  defineHorizontalRule,
  defineImage,
  defineInlineDoc,
  defineList,
  defineParagraph,
  defineTable,
  defineText,
} from './nodes.ts';

/**
 * The interaction tail every editor wants and no document shape depends on:
 * the base keymap, the base commands, undo/redo history, the gap cursor, the
 * virtual selection and mod-click prevention.
 *
 * None of these registers a node or a mark, so including them changes nothing
 * about what a derived wire schema accepts — which is why compiling a schema
 * for validation alone can include them without consequence, and why they are
 * a separate export rather than baked into the node lists.
 */
export function defineEditorBehaviour() {
  return union(
    defineBaseKeymap(),
    defineBaseCommands(),
    defineHistory(),
    defineGapCursor(),
    defineVirtualSelection(),
    defineModClickPrevention(),
  );
}

/**
 * The block-document grammar: a `block+` top node, text, ProseKit's stock
 * block set (paragraph, heading, list, blockquote, image, horizontal rule,
 * hard break, table, code block), {@link defineStandardMarks} and
 * {@link defineEditorBehaviour}, plus whatever `extra` extensions the caller
 * composes in.
 */
export function defineBlockDocumentExtension(...extra: ReadonlyArray<Extension>) {
  return union(
    defineDoc(),
    defineText(),
    defineParagraph(),
    defineHeading(),
    defineList(),
    defineBlockquote(),
    defineImage(),
    defineHorizontalRule(),
    defineHardBreak(),
    defineTable(),
    defineCodeBlock(),
    defineStandardMarks(),
    defineEditorBehaviour(),
    ...extra,
  );
}

/** The extension {@link defineBlockDocumentExtension} returns with no extras. */
export type BlockDocumentExtension = ReturnType<typeof defineBlockDocumentExtension>;

/**
 * The inline-document grammar: an `inline*` top node
 * ({@link defineInlineDoc}), text, {@link defineStandardMarks} and
 * {@link defineEditorBehaviour}, plus whatever `extra` extensions the caller
 * composes in.
 *
 * No block node is registered at all, so a paragraph is not merely
 * unreachable from the toolbar — it fails to decode.
 */
export function defineInlineDocumentExtension(...extra: ReadonlyArray<Extension>) {
  return union(
    defineInlineDoc(),
    defineText(),
    defineStandardMarks(),
    defineEditorBehaviour(),
    ...extra,
  );
}

/** The extension {@link defineInlineDocumentExtension} returns with no extras. */
export type InlineDocumentExtension = ReturnType<typeof defineInlineDocumentExtension>;
