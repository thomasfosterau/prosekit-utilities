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
  const blocks: Record<string, BlockSerialiser> = { ...stockBlocks, ...options?.blocks };
  const inlines: Record<string, InlineSerialiser> = { ...stockInlines, ...options?.inlines };
  const marks: Record<string, MarkSerialiser> = { ...stockMarks, ...options?.marks };

  /**
   * Applies a text node's marks to its text.
   *
   * `code` is verbatim: its content is never escaped and the other emphasis
   * marks do not wrap a code span, because they have no meaning inside one.
   * A `link` always wraps outermost, so the styled text becomes the label.
   * A mark with no serialiser (underline, highlight, sub- and superscript
   * have no Markdown form) passes through as plain styled-or-unstyled text.
   */
  const applyMarks = (text: string, nodeMarks: ReadonlyArray<MarkJSON> | undefined): string => {
    if (!nodeMarks || nodeMarks.length === 0) return escapeMarkdown(text);

    const codeMark = nodeMarks.find((mark) => mark.type === 'code');
    const codeSerialiser = marks.code;
    const verbatim = codeMark !== undefined && codeSerialiser !== undefined;

    let out = verbatim ? codeSerialiser(text, codeMark) : escapeMarkdown(text);

    if (!verbatim) {
      for (const type of EMPHASIS_ORDER) {
        const mark = nodeMarks.find((candidate) => candidate.type === type);
        const serialiser = marks[type];
        if (mark !== undefined && serialiser !== undefined) out = serialiser(out, mark);
      }
      for (const mark of nodeMarks) {
        if (mark.type === 'code' || mark.type === 'link') continue;
        if (EMPHASIS_ORDER.includes(mark.type)) continue;
        const serialiser = marks[mark.type];
        if (serialiser !== undefined) out = serialiser(out, mark);
      }
    }

    const link = nodeMarks.find((mark) => mark.type === 'link');
    const linkSerialiser = marks.link;
    if (link !== undefined && linkSerialiser !== undefined) out = linkSerialiser(out, link);
    return out;
  };

  /** Serialise a run of inline nodes to a single line-ish string. */
  const serialiseInline = (nodes: ReadonlyArray<NodeJSON>): string => {
    let out = '';
    for (const node of nodes) {
      if (node.type === 'text' && typeof node.text === 'string') {
        out += applyMarks(node.text, node.marks);
        continue;
      }
      const serialiser = inlines[node.type];
      // An inline node with no serialiser contributes nothing: it is inside a
      // paragraph whose surrounding text must not gain a stray placeholder.
      if (serialiser !== undefined) out += serialiser(node, context);
    }
    return out;
  };

  /** Marker for one list item, given the list node's `attrs` and its position. */
  const listMarker = (attrs: Record<string, unknown> | undefined, index: number): string => {
    // No attrs at all renders as a bullet, exactly as an absent/unknown `kind` does.
    if (attrs === undefined) return '- ';
    if (attrs.kind === 'ordered') {
      const start = typeof attrs.order === 'number' ? attrs.order : 1;
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
  const serialiseListRun = (items: ReadonlyArray<NodeJSON>, indent: string): string => {
    const lines: string[] = [];
    items.forEach((item, index) => {
      const marker = listMarker(item.attrs, index);
      const itemBlocks = childrenOf(item);
      // The first children are the item's own content (typically a
      // paragraph); any further `list` children are the nested sub-list.
      const ownBlocks = itemBlocks.filter((child) => child.type !== 'list');
      const nested = itemBlocks.filter((child) => child.type === 'list');
      const body = serialiseBlocks(ownBlocks).trim();
      const continuation = indent + ' '.repeat(marker.length);
      const bodyLines = body.split('\n');
      lines.push(
        indent +
          marker +
          (bodyLines[0] ?? '') +
          bodyLines
            .slice(1)
            .map((line) => '\n' + (line.length > 0 ? continuation + line : ''))
            .join(''),
      );
      if (nested.length > 0) {
        lines.push(serialiseListRun(nested, indent + LIST_INDENT));
      }
    });
    return lines.join('\n');
  };

  /** Serialise a single block node (no trailing blank line). */
  const serialiseBlock = (node: NodeJSON): string => {
    const serialiser = blocks[node.type];
    if (serialiser !== undefined) return serialiser(node, context);
    // Unknown / unhandled node: fall back to its inline text so nothing is
    // silently lost.
    return serialiseInline(childrenOf(node));
  };

  /**
   * Serialise an array of block nodes, grouping consecutive `list` siblings
   * into one list and separating blocks with blank lines.
   */
  const serialiseBlocks = (nodes: ReadonlyArray<NodeJSON>): string => {
    const chunks: string[] = [];
    let index = 0;
    while (index < nodes.length) {
      const node = nodes[index]!;
      if (node.type === 'list') {
        const run: NodeJSON[] = [];
        while (index < nodes.length && nodes[index]!.type === 'list') {
          run.push(nodes[index]!);
          index++;
        }
        chunks.push(serialiseListRun(run, ''));
        continue;
      }
      const rendered = serialiseBlock(node);
      if (rendered.length > 0) chunks.push(rendered);
      index++;
    }
    return chunks.join('\n\n');
  };

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
