/**
 * Node extensions: ProseKit's stock set, re-exported, plus the opt-in node
 * definitions this library adds.
 *
 * The stock re-exports exist so a consumer composes one grammar from one
 * import rather than a dozen `prosekit/extensions/*` specifiers, and so the
 * presets in `./presets.ts` and an application's own extension are provably
 * built from the same definitions.
 *
 * The opt-in nodes below are **not** in either preset. Each one changes what
 * the derived wire schema accepts, and a document written under a grammar
 * that includes `mention` does not decode under one that does not, so adding
 * one is a deliberate act at the application's own `defineBlockDocumentExtension(…)`
 * call site. Every `toDOM` here emits data attributes only — no `href`, no
 * `src` — so the one URL-valued attribute in the stock grammar stays the
 * `image` node's `src`, which `sanitiseDocument` and `isSafeHref` already
 * gate (SEC-XSS-001 in the source applications).
 *
 * @module
 */

import { defineNodeSpec, union } from 'prosekit/core';

// ---------------------------------------------------------------------------
// ProseKit stock node extensions, re-exported
// ---------------------------------------------------------------------------

export { defineDoc, type DocExtension } from 'prosekit/extensions/doc';
export { defineText, type TextExtension } from 'prosekit/extensions/text';
export { defineParagraph, type ParagraphExtension } from 'prosekit/extensions/paragraph';
export { defineHeading, type HeadingExtension } from 'prosekit/extensions/heading';
export { defineList, type ListExtension } from 'prosekit/extensions/list';
export { defineBlockquote, type BlockquoteExtension } from 'prosekit/extensions/blockquote';
export { defineImage, type ImageExtension } from 'prosekit/extensions/image';
export {
  defineHorizontalRule,
  type HorizontalRuleExtension,
} from 'prosekit/extensions/horizontal-rule';
export { defineHardBreak, type HardBreakExtension } from 'prosekit/extensions/hard-break';
export { defineTable, type TableExtension } from 'prosekit/extensions/table';
export { defineCodeBlock, type CodeBlockExtension } from 'prosekit/extensions/code-block';

// ---------------------------------------------------------------------------
// The inline-only top node
// ---------------------------------------------------------------------------

/**
 * A `doc` top node that accepts inline content only (`content: "inline*"`).
 *
 * The shape a single-line rich-text field wants: marks and text, no
 * paragraphs, no blocks. Each compiled schema owns its own node registry, so
 * this never conflicts with the stock `defineDoc()` (`content: "block+"`) —
 * the two simply belong to different extensions.
 */
export function defineInlineDoc() {
  return defineNodeSpec({
    name: 'doc',
    content: 'inline*',
    topNode: true,
  });
}

// ---------------------------------------------------------------------------
// Opt-in nodes
// ---------------------------------------------------------------------------

/**
 * An inline atom that points at an entity by id and carries the text to
 * render for it — the `@name` shape.
 *
 * `id` is the stable handle a consumer resolves (a notification fan-out, a
 * profile link); `label` is display text and is untrusted, which is why
 * `toDOM` emits it as a text child rather than as markup. The node is an
 * atom, so nothing can be typed inside it and the label only ever changes by
 * replacing the whole node.
 *
 * This is deliberately **not** `prosekit/extensions/mention`: ProseKit's stock
 * mention carries a different attribute shape, and this one is wire-identical
 * to documents the source applications have already persisted.
 */
export function defineMention() {
  return defineNodeSpec({
    name: 'mention',
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      id: { default: '' },
      label: { default: '' },
    },
    parseDOM: [
      {
        tag: 'span[data-mention-id]',
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute('data-mention-id') ?? '',
          label: (dom as HTMLElement).getAttribute('data-mention-label') ?? '',
        }),
      },
    ],
    toDOM(node) {
      const { id, label } = node.attrs as { id: string; label: string };
      return [
        'span',
        { 'data-mention-id': id, 'data-mention-label': label, class: 'mention' },
        `@${label}`,
      ];
    },
  });
}

/**
 * The caption half of a figure: inline content only.
 *
 * `content: "inline*"` rather than `block+` is what stops a caption nesting a
 * paragraph, a list, or another figure — a caption is a line of prose, and
 * the derived wire schema enforces exactly that because it reads this content
 * expression off the compiled schema.
 */
export function defineFigcaption() {
  return defineNodeSpec({
    name: 'figcaption',
    content: 'inline*',
    parseDOM: [{ tag: 'figcaption' }],
    toDOM() {
      return ['figcaption', 0];
    },
  });
}

/**
 * A captioned image block: exactly one `image` followed by exactly one
 * `figcaption`.
 *
 * The fixed content expression is the point — a figure is a pair, not a
 * container, so neither half can be dropped or duplicated. `defining` keeps
 * the figure as its own context on paste rather than dissolving into the
 * surrounding block.
 *
 * Use {@link defineFigure} unless you are composing the two halves yourself:
 * this node is unusable without {@link defineFigcaption} in the same
 * extension, and the stock `image` node besides.
 */
export function defineFigureNode() {
  return defineNodeSpec({
    name: 'figure',
    group: 'block',
    content: 'image figcaption',
    defining: true,
    parseDOM: [{ tag: 'figure' }],
    toDOM() {
      return ['figure', 0];
    },
  });
}

/** {@link defineFigureNode} together with its {@link defineFigcaption} child. */
export function defineFigure() {
  return union(defineFigureNode(), defineFigcaption());
}

/**
 * An inline aside that sits alongside the body prose — a reference note the
 * reader can take or leave, rendered in the margin on wide viewports and as a
 * footnote-like inline block on narrow ones.
 *
 * The note holds **rich inline content** (text plus the surrounding marks),
 * not a plain-text attribute, so a link or emphasis inside a note round-trips
 * through the node's own children on every surface: the editor, the HTML
 * serialiser, the Markdown walk and paste.
 *
 * It is `inline: true` but deliberately **not** `atom`: that is what lets the
 * cursor enter the note and edit its content in place with the same toolbar
 * that styles body prose, with no nested editor and no node view. An `atom`
 * inline node cannot hold editable inline children without one. `selectable`
 * makes the whole note pickable; `defining` keeps its boundary on paste.
 *
 * Its content is `(text | hardBreak)*` — the two text-like inline nodes by
 * name, not the broad `inline` group — so **a note can never nest a note**.
 * `sidenote` is itself in group `inline`, so `content: "inline*"` would admit
 * `^[…^[…]…]`, which has no valid inline-footnote rendering in Markdown; the
 * derived wire schema reads this very expression off the compiled schema and
 * rejects the nesting for free.
 *
 * Placement is a render-time, CSS-only concern: the node is layout-agnostic
 * and ships no styles.
 */
export function defineSidenote() {
  return defineNodeSpec({
    name: 'sidenote',
    group: 'inline',
    inline: true,
    content: '(text | hardBreak)*',
    defining: true,
    selectable: true,
    parseDOM: [{ tag: 'span[data-sidenote]' }],
    // The trailing `0` is the content hole: the inline children render inside
    // the span, through the same escaping and link-sanitising pipeline as the
    // surrounding prose, so a note introduces no new XSS surface.
    toDOM: () => ['span', { 'data-sidenote': '' }, 0],
  });
}
