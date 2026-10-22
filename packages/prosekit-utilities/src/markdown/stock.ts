/**
 * The stock Markdown cases: every node and mark in the shared base grammar.
 *
 * These are what `createMarkdownSerialiser` starts from, and an application
 * may replace any of them by name. They are exported individually so one can
 * be reused inside a replacement (a custom `image` that adds alt text can
 * still defer to `imageMarkdown` for the safe-URL check).
 *
 * @module
 */

import * as Arr from 'effect/Array';
import * as Predicate from 'effect/Predicate';
import * as String from 'effect/String';
import type { DocumentJSON, MarkJSON, NodeJSON } from '../json.ts';
import { isSafeHref } from '../url-safety.ts';
import type { BlockSerialiser, InlineSerialiser, MarkSerialiser } from './serialiser.ts';

/**
 * A node's children as an array, whether or not it has any.
 *
 * Shared by the engine and by every serialiser that renders its own
 * children, so a missing `content` is one empty array rather than a
 * different guard in each case.
 */
export const childrenOf = (node: NodeJSON | DocumentJSON): ReadonlyArray<NodeJSON> =>
  node.content ?? [];

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

/** `` `code` `` — verbatim, so the engine skips escaping and other emphasis. */
const codeMarkdown: MarkSerialiser = (text) => `\`${text}\``;

/** `~~strike~~`. */
const strikeMarkdown: MarkSerialiser = (text) => `~~${text}~~`;

/** `*italic*`. */
const italicMarkdown: MarkSerialiser = (text) => `*${text}*`;

/** `**bold**`. */
const boldMarkdown: MarkSerialiser = (text) => `**${text}**`;

/**
 * `[text](href)`, but only for an `href` the safe-URL allow-list admits — an
 * unsafe scheme degrades to the plain (still styled) link text rather than
 * emitting an executable URI.
 */
const linkMarkdown: MarkSerialiser = (text, mark: MarkJSON) => {
  const href = mark.attrs?.href;
  return isSafeHref(href) ? `[${text}](${href.trim()})` : text;
};

/**
 * The marks with a Markdown rendering.
 *
 * Underline, highlight, subscript and superscript are deliberately absent:
 * CommonMark has no form for them, and a mark with no entry passes its text
 * through unchanged, which is what both source applications do.
 */
export const stockMarks = {
  bold: boldMarkdown,
  code: codeMarkdown,
  italic: italicMarkdown,
  link: linkMarkdown,
  strike: strikeMarkdown,
} satisfies Record<string, MarkSerialiser>;

// ---------------------------------------------------------------------------
// Inline nodes
// ---------------------------------------------------------------------------

/**
 * A hard break as a backslash line break, which is more robust than two
 * trailing spaces (an editor or a diff tool that trims trailing whitespace
 * cannot silently delete it).
 */
const hardBreakMarkdown: InlineSerialiser = () => '\\\n';

/** The inline nodes in the shared base grammar. */
export const stockInlines = {
  hardBreak: hardBreakMarkdown,
} satisfies Record<string, InlineSerialiser>;

// ---------------------------------------------------------------------------
// Block nodes
// ---------------------------------------------------------------------------

/** A paragraph: its inline content, nothing more. */
const paragraphMarkdown: BlockSerialiser = (node, context) =>
  context.serialiseInline(childrenOf(node));

/** `## Heading`, clamped into the 1..6 range CommonMark defines. */
const headingMarkdown: BlockSerialiser = (node, context) => {
  const declared = Predicate.isNumber(node.attrs?.level) ? node.attrs.level : 1;
  const level = Math.min(Math.max(declared, 1), 6);
  return `${'#'.repeat(level)} ${context.serialiseInline(childrenOf(node))}`;
};

/** `> quoted`, with a bare `>` on the blank lines between inner blocks. */
const blockquoteMarkdown: BlockSerialiser = (node, context) =>
  context
    .serialiseBlocks(childrenOf(node))
    .split('\n')
    .map((line) => (String.isNonEmpty(line) ? `> ${line}` : '>'))
    .join('\n');

/**
 * A fenced code block.
 *
 * The language token is stripped of newlines and backticks so it cannot
 * break out of the fence line, and the fence itself is at least one
 * backtick longer than the longest run inside the code, so embedded triple
 * backticks cannot close the block early.
 */
const codeBlockMarkdown: BlockSerialiser = (node) => {
  const declared = Predicate.isString(node.attrs?.language) ? node.attrs.language : '';
  const language = declared.replace(/[\n\r`]/g, '');
  const code = childrenOf(node)
    .map((child) => child.text ?? '')
    .join('');
  const longestRun = Math.max(0, ...[...code.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${code}\n${fence}`;
};

/** `---`. */
const horizontalRuleMarkdown: BlockSerialiser = () => '---';

/**
 * `![](src)` for a `src` the safe-URL allow-list admits; the empty string
 * otherwise, which drops the block from the output entirely.
 */
const imageMarkdown: BlockSerialiser = (node) => {
  const src = node.attrs?.src;
  return isSafeHref(src) ? `![](${src.trim()})` : '';
};

/**
 * A GitHub-flavoured pipe table, best-effort: the first row becomes the
 * header, every row is padded out to the widest row's column count, and a
 * cell's own block structure is flattened onto one line with its pipes
 * escaped.
 */
const tableMarkdown: BlockSerialiser = (node, context) => {
  const cellText = (cell: NodeJSON): string =>
    context.serialiseBlocks(childrenOf(cell)).trim().replace(/\n+/g, ' ').replace(/\|/g, '\\|');
  return Arr.match(
    childrenOf(node).filter((row) => row.type === 'tableRow'),
    {
      onEmpty: () => '',
      onNonEmpty: (rows) => {
        const [header, ...body] = Arr.map(rows, (row) => childrenOf(row).map(cellText));
        const columns = Math.max(header.length, ...body.map((row) => row.length), 1);
        const pad = (cells: Array<string>): string =>
          `| ${Arr.pad(cells, columns, '').join(' | ')} |`;
        return [
          pad(header),
          `| ${Arr.replicate('---', columns).join(' | ')} |`,
          ...body.map(pad),
        ].join('\n');
      },
    },
  );
};

/**
 * The block nodes in the shared base grammar.
 *
 * `list` is absent on purpose: consecutive `list` siblings are one list in
 * the prosemirror-flat-list model, so the run, not the node, is the unit of
 * serialisation and the engine owns it.
 */
export const stockBlocks = {
  blockquote: blockquoteMarkdown,
  codeBlock: codeBlockMarkdown,
  heading: headingMarkdown,
  horizontalRule: horizontalRuleMarkdown,
  image: imageMarkdown,
  paragraph: paragraphMarkdown,
  table: tableMarkdown,
} satisfies Record<string, BlockSerialiser>;
