/**
 * The Markdown serialiser engine: the dispatch, the mark ladder and the
 * prosemirror-flat-list run model that every stock and application node
 * serialiser plugs into.
 *
 * Walks the ProseMirror document JSON tree directly (no DOM) and emits
 * clean, CommonMark-flavoured Markdown — the representation an agent-facing
 * `Accept: text/markdown` surface serves. A pure, dependency-free tree-walk,
 * so it runs on a Worker without a DOM shim, unlike the HTML serialiser in
 * the ProseKit entry point.
 *
 * Security: link `href`s and image `src`s go through the same `isSafeHref`
 * allow-list the HTML serialiser uses; an unsafe `href` degrades to plain
 * link text, never an executable URI.
 *
 * @module
 */

import * as Arr from 'effect/Array';
import * as Option from 'effect/Option';
import * as Predicate from 'effect/Predicate';
import * as Result from 'effect/Result';
import * as String from 'effect/String';
import type { DocumentJSON, MarkJSON, NodeJSON } from '../json.ts';
import { escapeMarkdown } from './escape.ts';
import { childrenOf, stockBlocks, stockInlines, stockMarks } from './stock.ts';

// ---------------------------------------------------------------------------
// The plug-in shapes
// ---------------------------------------------------------------------------

/**
 * What a node serialiser is handed alongside its node: the two recursive
 * passes and the escaping function, so an application's serialiser renders
 * its children exactly as the stock ones do.
 */
export interface MarkdownContext {
  /** Serialise a run of inline nodes (text with marks, hard breaks, atoms). */
  readonly serialiseInline: (nodes: ReadonlyArray<NodeJSON>) => string;
  /** Serialise a run of block nodes, grouping consecutive list siblings. */
  readonly serialiseBlocks: (nodes: ReadonlyArray<NodeJSON>) => string;
  /** Backslash-escape CommonMark metacharacters in literal text. */
  readonly escape: (text: string) => string;
}

/** Renders one block node. Returns `''` to drop the block entirely. */
export type BlockSerialiser = (node: NodeJSON, context: MarkdownContext) => string;

/** Renders one non-text inline node. Returns `''` to contribute nothing. */
export type InlineSerialiser = (node: NodeJSON, context: MarkdownContext) => string;

/** Wraps already-rendered text in one mark's Markdown syntax. */
export type MarkSerialiser = (text: string, mark: MarkJSON) => string;

/** A configured serialiser: one entry point per document shape. */
export interface MarkdownSerialiser {
  /** A block document → multi-line Markdown, trimmed. */
  readonly document: (doc: NodeJSON | DocumentJSON) => string;
  /** An inline document → a single line of Markdown, trimmed. */
  readonly inline: (doc: NodeJSON | DocumentJSON) => string;
}

// ---------------------------------------------------------------------------
// Ordering constants
// ---------------------------------------------------------------------------

/**
 * Emphasis marks in the order they wrap, innermost first.
 *
 * Fixed rather than document order, because a text run's `marks` array is in
 * whatever order the editor happened to add them and `***~~x~~***` must come
 * out the same way every time. A mark outside this list (an application's
 * own) wraps after these and before the link.
 */
const EMPHASIS_ORDER: ReadonlyArray<string> = ['strike', 'italic', 'bold'];

/** One nesting level of list indentation. */
const LIST_INDENT = '  ';

/**
 * The serialiser registered for a type name: the application's own entry if
 * it has one, the stock entry otherwise — the application's map merged over
 * the stock one.
 */
const serialiserLookup =
  <S extends Readonly<Record<string, A>>, A>(stock: S, overrides: Readonly<Record<string, A>>) =>
  (type: string): Option.Option<A> =>
    Option.fromNullishOr(overrides[type] ?? stock[type]);

/** The first of `marks` whose type is `type`. */
const markOfType = (marks: ReadonlyArray<MarkJSON>, type: string): Option.Option<MarkJSON> =>
  Arr.findFirst(marks, (mark) => mark.type === type);

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/**
 * Builds a Markdown serialiser.
 *
 * The stock cases — paragraph, heading, blockquote, code block, horizontal
 * rule, image, table, hard break and the five marks with a Markdown form —
 * are built in, along with the flat-list run model and the fallback that
 * emits an unknown node's inline text rather than dropping it. `blocks`,
 * `inlines` and `marks` are merged **over** the stock maps, so an
 * application adds its own nodes (and may replace a stock one) without
 * restating any of this:
 *
 * ```ts
 * const toMarkdown = createMarkdownSerialiser({
 *   inlines: { mention: mentionMarkdown },
 *   blocks: { figure: figureMarkdown },
 * });
 * ```
 *
 * `list` is the one type a `blocks` entry cannot override: consecutive
 * `list` siblings are one list, so the run — not the node — is the unit of
 * serialisation, and that grouping lives here.
 */
export function createMarkdownSerialiser(options?: {
  readonly blocks?: Record<string, BlockSerialiser> | undefined;
  readonly inlines?: Record<string, InlineSerialiser> | undefined;
  readonly marks?: Record<string, MarkSerialiser> | undefined;
}): MarkdownSerialiser {
  const blocks = serialiserLookup(stockBlocks, options?.blocks ?? {});
  const inlines = serialiserLookup(stockInlines, options?.inlines ?? {});
  const marks = serialiserLookup(stockMarks, options?.marks ?? {});

  /** Wraps `text` in `mark`'s syntax when a serialiser exists for it. */
  const applyMark = (text: string, mark: MarkJSON): string =>
    Option.match(marks(mark.type), {
      onNone: () => text,
      onSome: (serialiser) => serialiser(text, mark),
    });

  /**
   * Applies a text node's marks to its text.
   *
   * `code` is verbatim: its content is never escaped and the other emphasis
   * marks do not wrap a code span, because they have no meaning inside one.
   * A `link` always wraps outermost, so the styled text becomes the label.
   * A mark with no serialiser (underline, highlight, sub- and superscript
   * have no Markdown form) passes through as plain styled-or-unstyled text.
   */
  const applyMarks = (text: string, nodeMarks: ReadonlyArray<MarkJSON>): string =>
    Arr.match(nodeMarks, {
      onEmpty: () => escapeMarkdown(text),
      onNonEmpty: (present) => {
        const verbatim = Option.zipWith(
          markOfType(present, 'code'),
          marks('code'),
          (codeMark, serialiser) => serialiser(text, codeMark),
        );
        const styled = Option.getOrElse(verbatim, () =>
          Arr.reduce(
            present,
            Arr.reduce(EMPHASIS_ORDER, escapeMarkdown(text), (out, type) =>
              Option.match(markOfType(present, type), {
                onNone: () => out,
                onSome: (mark) => applyMark(out, mark),
              }),
            ),
            (out, mark) =>
              mark.type === 'code' || mark.type === 'link' || EMPHASIS_ORDER.includes(mark.type)
                ? out
                : applyMark(out, mark),
          ),
        );
        return Option.getOrElse(
          Option.zipWith(markOfType(present, 'link'), marks('link'), (link, serialiser) =>
            serialiser(styled, link),
          ),
          () => styled,
        );
      },
    });

  /** Serialise a run of inline nodes to a single line-ish string. */
  const serialiseInline = (nodes: ReadonlyArray<NodeJSON>): string =>
    Arr.map(nodes, (node) =>
      node.type === 'text' && Predicate.isString(node.text)
        ? applyMarks(node.text, node.marks ?? [])
        : // An inline node with no serialiser contributes nothing: it is inside
          // a paragraph whose surrounding text must not gain a stray placeholder.
          Option.match(inlines(node.type), {
            onNone: () => '',
            onSome: (serialiser) => serialiser(node, context),
          }),
    ).join('');

  /** Marker for one list item, given the list node and its position. */
  const listMarker = (item: NodeJSON, index: number): string => {
    const attrs = item.attrs;
    // No attrs at all renders as a bullet, exactly as an absent/unknown `kind` does.
    if (attrs === undefined) return '- ';
    if (attrs.kind === 'ordered') {
      const start = Predicate.isNumber(attrs.order) ? attrs.order : 1;
      return `${start + index}. `;
    }
    if (attrs.kind === 'task') {
      return attrs.checked === true ? '- [x] ' : '- [ ] ';
    }
    // bullet / toggle (Markdown has no toggle — render as a bullet).
    return '- ';
  };

  /**
   * Serialise a run of sibling `list` nodes. In the prosemirror-flat-list
   * model each `list` node is one item and consecutive siblings form the
   * list; a nested list is a `list` child inside an item's content, so it
   * recurses with deeper indentation.
   */
  const serialiseListRun = (items: ReadonlyArray<NodeJSON>, indent: string): string =>
    Arr.flatMap(items, (item, index) => {
      const marker = listMarker(item, index);
      const itemBlocks = childrenOf(item);
      // The first children are the item's own content (typically a
      // paragraph); any further `list` children are the nested sub-list.
      const ownBlocks = itemBlocks.filter((child) => child.type !== 'list');
      const nested = itemBlocks.filter((child) => child.type === 'list');
      const body = serialiseBlocks(ownBlocks).trim();
      const continuation = indent + ' '.repeat(marker.length);
      const bodyLines = body.split('\n');
      const line =
        indent +
        marker +
        (bodyLines[0] ?? '') +
        bodyLines
          .slice(1)
          .map((next) => '\n' + (String.isNonEmpty(next) ? continuation + next : ''))
          .join('');
      return Arr.match(nested, {
        onEmpty: () => [line],
        onNonEmpty: (sublist) => [line, serialiseListRun(sublist, indent + LIST_INDENT)],
      });
    }).join('\n');

  /** Serialise a single block node (no trailing blank line). */
  const serialiseBlock = (node: NodeJSON): string =>
    Option.match(blocks(node.type), {
      onSome: (serialiser) => serialiser(node, context),
      // Unknown / unhandled node: fall back to its inline text so nothing is
      // silently lost.
      onNone: () => serialiseInline(childrenOf(node)),
    });

  /**
   * Serialise an array of block nodes, grouping consecutive `list` siblings
   * into one list and separating blocks with blank lines. Every other block
   * is a group of its own, and one that renders to nothing is dropped.
   */
  const serialiseBlocks = (nodes: ReadonlyArray<NodeJSON>): string =>
    Arr.match(nodes, {
      onEmpty: () => '',
      onNonEmpty: (present) =>
        Arr.filterMap(
          Arr.groupWith(present, (left, right) => left.type === 'list' && right.type === 'list'),
          (group) => {
            if (group[0].type === 'list') return Result.succeed(serialiseListRun(group, ''));
            const rendered = serialiseBlock(group[0]);
            return String.isNonEmpty(rendered) ? Result.succeed(rendered) : Result.failVoid;
          },
        ).join('\n\n'),
    });

  const context: MarkdownContext = {
    serialiseInline,
    serialiseBlocks,
    escape: escapeMarkdown,
  };

  return {
    document: (doc) => serialiseBlocks(childrenOf(doc)).trim(),
    inline: (doc) => serialiseInline(childrenOf(doc)).trim(),
  };
}
