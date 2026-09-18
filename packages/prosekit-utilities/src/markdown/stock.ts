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
export const childrenOf = (node: NodeJSON | DocumentJSON | undefined): ReadonlyArray<NodeJSON> =>
  node?.content === undefined ? [] : node.content;

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

/** `` `code` `` — verbatim, so the engine skips escaping and other emphasis. */
export const codeMarkdown: MarkSerialiser = (text) => `\`${text}\``;

/** `~~strike~~`. */
export const strikeMarkdown: MarkSerialiser = (text) => `~~${text}~~`;

/** `*italic*`. */
export const italicMarkdown: MarkSerialiser = (text) => `*${text}*`;

/** `**bold**`. */
export const boldMarkdown: MarkSerialiser = (text) => `**${text}**`;

/**
 * `[text](href)`, but only for an `href` the safe-URL allow-list admits — an
 * unsafe scheme degrades to the plain (still styled) link text rather than
 * emitting an executable URI.
 */
export const linkMarkdown: MarkSerialiser = (text, mark: MarkJSON) => {
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
export const stockMarks: Record<string, MarkSerialiser> = {
  bold: boldMarkdown,
  code: codeMarkdown,
  italic: italicMarkdown,
  link: linkMarkdown,
  strike: strikeMarkdown,
};

// ---------------------------------------------------------------------------
// Inline nodes
// ---------------------------------------------------------------------------

/**
 * A hard break as a backslash line break, which is more robust than two
 * trailing spaces (an editor or a diff tool that trims trailing whitespace
 * cannot silently delete it).
 */
export const hardBreakMarkdown: InlineSerialiser = () => '\\\n';

/** The inline nodes in the shared base grammar. */
export const stockInlines: Record<string, InlineSerialiser> = {
  hardBreak: hardBreakMarkdown,
};

// ---------------------------------------------------------------------------
// Block nodes
// ---------------------------------------------------------------------------

/** A paragraph: its inline content, nothing more. */
export const paragraphMarkdown: BlockSerialiser = (node, context) =>
  context.serialiseInline(childrenOf(node));

/** `## Heading`, clamped into the 1..6 range CommonMark defines. */
export const headingMarkdown: BlockSerialiser = (node, context) => {
  const declared = typeof node.attrs?.level === 'number' ? node.attrs.level : 1;
  const level = Math.min(Math.max(declared, 1), 6);
  return `${'#'.repeat(level)} ${context.serialiseInline(childrenOf(node))}`;
};

/** `> quoted`, with a bare `>` on the blank lines between inner blocks. */
export const blockquoteMarkdown: BlockSerialiser = (node, context) =>
  context
    .serialiseBlocks(childrenOf(node))
    .split('\n')
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
    .join('\n');

/**
 * A fenced code block.
 *
 * The language token is stripped of newlines and backticks so it cannot
 * break out of the fence line, and the fence itself is at least one
 * backtick longer than the longest run inside the code, so embedded triple
 * backticks cannot close the block early.
 */
export const codeBlockMarkdown: BlockSerialiser = (node) => {
  const declared = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
  const language = declared.replace(/[\n\r`]/g, '');
  const code = childrenOf(node)
    .map((child) => child.text ?? '')
    .join('');
  const longestRun = Math.max(0, ...[...code.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${code}\n${fence}`;
};

/** `---`. */
export const horizontalRuleMarkdown: BlockSerialiser = () => '---';

/**
 * `![](src)` for a `src` the safe-URL allow-list admits; the empty string
 * otherwise, which drops the block from the output entirely.
 */
export const imageMarkdown: BlockSerialiser = (node) => {
  const src = node.attrs?.src;
  return isSafeHref(src) ? `![](${src.trim()})` : '';
};

/**
 * A GitHub-flavoured pipe table, best-effort: the first row becomes the
 * header, every row is padded out to the widest row's column count, and a
 * cell's own block structure is flattened onto one line with its pipes
 * escaped.
 */
export const tableMarkdown: BlockSerialiser = (node, context) => {
  const rows = childrenOf(node).filter((row) => row.type === 'tableRow');
  if (rows.length === 0) return '';
  const cellText = (cell: NodeJSON): string =>
    context.serialiseBlocks(childrenOf(cell)).trim().replace(/\n+/g, ' ').replace(/\|/g, '\\|');
  const rendered = rows.map((row) => childrenOf(row).map(cellText));
  const columns = Math.max(...rendered.map((row) => row.length), 1);
  const pad = (cells: ReadonlyArray<string>): string => {
    const filled = [...cells];
    while (filled.length < columns) filled.push('');
    return `| ${filled.join(' | ')} |`;
  };
  const lines = [pad(rendered[0] ?? [])];
  lines.push(`| ${Array.from({ length: columns }, () => '---').join(' | ')} |`);
  for (const row of rendered.slice(1)) lines.push(pad(row));
  return lines.join('\n');
};

/**
 * The block nodes in the shared base grammar.
 *
 * `list` is absent on purpose: consecutive `list` siblings are one list in
 * the prosemirror-flat-list model, so the run, not the node, is the unit of
 * serialisation and the engine owns it.
 */
export const stockBlocks: Record<string, BlockSerialiser> = {
  blockquote: blockquoteMarkdown,
  codeBlock: codeBlockMarkdown,
  heading: headingMarkdown,
  horizontalRule: horizontalRuleMarkdown,
  image: imageMarkdown,
  paragraph: paragraphMarkdown,
  table: tableMarkdown,
};
