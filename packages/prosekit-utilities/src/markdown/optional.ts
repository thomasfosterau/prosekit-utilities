/**
 * Markdown cases for the opt-in nodes — the ones an application composes
 * into its grammar rather than getting for free.
 *
 * Each is an ordinary {@link BlockSerialiser} / {@link InlineSerialiser}, so
 * it is wired in through `createMarkdownSerialiser`'s option maps:
 *
 * ```ts
 * const toMarkdown = createMarkdownSerialiser({
 *   blocks: { figure: figureMarkdown },
 *   inlines: { mention: mentionMarkdown, sidenote: sidenoteMarkdown },
 * });
 * ```
 *
 * They exist because a node with no faithful Markdown form must still emit
 * its closest textual equivalent rather than vanish: the Markdown has to
 * stay a truthful reflection of what the HTML renders.
 *
 * @module
 */

import * as Predicate from 'effect/Predicate';
import * as String from 'effect/String';
import type { BlockSerialiser, InlineSerialiser } from './serialiser.ts';
import { childrenOf } from './stock.ts';

/**
 * A mention as its `@label`, escaped.
 *
 * The referenced account's id has no Markdown form and is dropped: a
 * mention is a link to something only the application can resolve, so the
 * text is all that survives. The label is escaped like any other literal
 * text, so a display name containing `*` cannot open emphasis.
 */
export const mentionMarkdown: InlineSerialiser = (node, context) => {
  const label = Predicate.isString(node.attrs?.label) ? node.attrs.label : '';
  return context.escape(`@${label}`);
};

/**
 * A figure as its image line followed by the caption as an italic
 * paragraph — Markdown has no figure element, and this is the form a reader
 * renders closest to one.
 *
 * A figure whose image is dropped (an unsafe `src`) still emits its caption;
 * a figure with no caption emits the image line alone.
 */
export const figureMarkdown: BlockSerialiser = (node, context) => {
  const [image, caption] = childrenOf(node);
  const imageLine = image === undefined ? '' : context.serialiseBlocks([image]);
  const captionText =
    caption === undefined ? '' : context.serialiseInline(childrenOf(caption)).trim();
  return String.isNonEmpty(captionText) ? `${imageLine}\n_${captionText}_` : imageLine;
};

/**
 * A sidenote as a Pandoc inline footnote (`^[note]`).
 *
 * This is the established Markdown form for a reference aside with no
 * separate definition block: it keeps the note where it sits in the prose
 * and renders as a footnote in Pandoc-flavoured pipelines, the closest
 * faithful analogue to a margin note. `^[…]` is a Pandoc extension, not core
 * CommonMark; a plain CommonMark reader shows the bracketed content inline,
 * which still reads as a parenthetical aside.
 *
 * The note holds rich inline content, so its children go through the same
 * inline pass body prose does — `^[…]` legitimately contains inline Markdown
 * (`[t](u)`, `*em*`, `` `code` ``), and literal `[` / `]` in a text run is
 * already backslash-escaped so it cannot close the note early. Any newline
 * (a hard break renders as `\␤`) is collapsed to a space afterwards: a
 * literal newline would terminate the inline footnote and split the
 * surrounding paragraph.
 *
 * A nested sidenote is flattened to its body first. A grammar restricting a
 * sidenote to `(text | hardBreak)*` rules one out, but a persistence guard
 * checks the node registry rather than content expressions, so a
 * hand-crafted or migrated document can still carry one — and `^[…^[…]…]`
 * has no valid Pandoc rendering, since the inner `]` closes the outer note.
 */
export const sidenoteMarkdown: InlineSerialiser = (node, context) => {
  const inlineChildren = childrenOf(node).flatMap((child) =>
    child.type === 'sidenote' ? childrenOf(child) : [child],
  );
  const body = context.serialiseInline(inlineChildren).replace(/\\?\n/g, ' ').trim();
  return String.isNonEmpty(body) ? `^[${body}]` : '';
};
