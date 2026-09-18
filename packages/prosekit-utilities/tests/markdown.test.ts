/**
 * Behavioural tests for the document → Markdown serialiser.
 *
 * Pins faithful, clean CommonMark for every node and mark in the shared base
 * grammar plus the security-critical edges: the link / image safe-URL
 * allow-list (an unsafe `href` degrades to plain text, never an executable
 * URI), metacharacter escaping (a literal `*` / `[` cannot be reinterpreted
 * as syntax), code-fence widening (an embedded ``` cannot close a fence
 * early), and nested-list indentation. WHY: a pure dependency-free tree-walk
 * runs on a Worker without a DOM, so its output is the only thing standing
 * between authored prose and a malformed or unsafe Markdown render.
 *
 * The opt-in node cases — mention, figure, sidenote — go through the option
 * maps, which is how an application composes them, so this file exercises
 * the extension seam at the same time.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import type { DocumentJSON, MarkJSON, NodeJSON } from '../src/json.ts';
import {
  createMarkdownSerialiser,
  escapeMarkdown,
  figureMarkdown,
  mentionMarkdown,
  sidenoteMarkdown,
  toMarkdown,
} from '../src/markdown/index.ts';

// ── Builders mirroring the ProseMirror JSON shape ─────────────────────

const block = (...content: ReadonlyArray<NodeJSON>): DocumentJSON => ({
  type: 'blockDocument',
  content,
});
const inline = (...content: ReadonlyArray<NodeJSON>): DocumentJSON => ({
  type: 'inlineDocument',
  content,
});
const text = (value: string, marks?: ReadonlyArray<MarkJSON>): NodeJSON => ({
  type: 'text',
  text: value,
  marks,
});
const link = (href: string): MarkJSON => ({ type: 'link', attrs: { href } });
const para = (...content: ReadonlyArray<NodeJSON>): NodeJSON => ({ type: 'paragraph', content });
const listItem = (
  kind: string,
  attrs: Record<string, unknown>,
  ...content: ReadonlyArray<NodeJSON>
): NodeJSON => ({ type: 'list', attrs: { kind, ...attrs }, content });

/** The stock serialiser: the shared base grammar and nothing else. */
const document = (doc: DocumentJSON): string => toMarkdown.document(doc);

/** A serialiser with every opt-in node wired in, as an application composes one. */
const extended = createMarkdownSerialiser({
  blocks: { figure: figureMarkdown },
  inlines: { mention: mentionMarkdown, sidenote: sidenoteMarkdown },
});

// ── Headings ──────────────────────────────────────────────────────────

describe('document: headings', () => {
  it('renders each heading at its declared level', () => {
    expect(
      document(
        block(
          { type: 'heading', attrs: { level: 1 }, content: [text('One')] },
          { type: 'heading', attrs: { level: 3 }, content: [text('Three')] },
        ),
      ),
    ).toBe('# One\n\n### Three');
  });

  it('defaults to level 1 when the attr is missing or non-numeric', () => {
    expect(document(block({ type: 'heading', content: [text('Default')] }))).toBe('# Default');
    expect(
      document(block({ type: 'heading', attrs: { level: 'two' }, content: [text('Bad')] })),
    ).toBe('# Bad');
  });

  it('clamps a heading level into the 1..6 range', () => {
    expect(
      document(
        block(
          { type: 'heading', attrs: { level: 0 }, content: [text('Lo')] },
          { type: 'heading', attrs: { level: 9 }, content: [text('Hi')] },
        ),
      ),
    ).toBe('# Lo\n\n###### Hi');
  });
});

// ── Paragraphs & inline marks ─────────────────────────────────────────

describe('document: paragraphs and marks', () => {
  it('separates paragraphs with a blank line', () => {
    expect(document(block(para(text('One')), para(text('Two'))))).toBe('One\n\nTwo');
  });

  it('applies emphasis marks (bold / italic / strike / code)', () => {
    expect(
      document(
        block(
          para(
            text('a', [{ type: 'bold' }]),
            text(' '),
            text('b', [{ type: 'italic' }]),
            text(' '),
            text('c', [{ type: 'strike' }]),
            text(' '),
            text('d', [{ type: 'code' }]),
          ),
        ),
      ),
    ).toBe('**a** *b* ~~c~~ `d`');
  });

  it('nests emphasis marks inside-out (strike innermost, then italic, then bold)', () => {
    expect(
      document(block(para(text('x', [{ type: 'bold' }, { type: 'italic' }, { type: 'strike' }])))),
    ).toBe('***~~x~~***');
  });

  it('applies that order whatever order the marks array carries', () => {
    expect(
      document(block(para(text('x', [{ type: 'strike' }, { type: 'bold' }, { type: 'italic' }])))),
    ).toBe('***~~x~~***');
  });

  it('treats a code mark as verbatim — no inner escaping or other emphasis', () => {
    // `code` wins: the metacharacters inside are NOT escaped, and a co-present
    // bold mark does not wrap a code span.
    expect(document(block(para(text('a*b_c', [{ type: 'code' }, { type: 'bold' }]))))).toBe(
      '`a*b_c`',
    );
  });

  it('ignores marks with no Markdown rendering (underline / highlight)', () => {
    expect(
      document(block(para(text('plain', [{ type: 'underline' }, { type: 'highlight' }])))),
    ).toBe('plain');
  });

  it('returns escaped text for an empty marks array', () => {
    expect(document(block(para(text('a*b', []))))).toBe('a\\*b');
  });
});

// ── Links ─────────────────────────────────────────────────────────────

describe('document: links', () => {
  it('wraps a safe link outermost so styled text becomes the label', () => {
    expect(
      document(block(para(text('docs', [{ type: 'bold' }, link('https://example.com')])))),
    ).toBe('[**docs**](https://example.com)');
  });

  it('trims surrounding whitespace from a safe href', () => {
    expect(document(block(para(text('x', [link('  https://example.com  ')]))))).toBe(
      '[x](https://example.com)',
    );
  });

  it('degrades an unsafe href to plain (styled) link text', () => {
    expect(document(block(para(text('click', [link('javascript:alert(1)')]))))).toBe('click');
  });

  it('degrades a link with a missing href to plain text', () => {
    expect(document(block(para(text('bare', [{ type: 'link' }]))))).toBe('bare');
  });

  it('renders mailto, root-relative, and fragment links', () => {
    expect(
      document(
        block(
          para(text('mail', [link('mailto:a@b.co')])),
          para(text('home', [link('/about')])),
          para(text('frag', [link('#top')])),
        ),
      ),
    ).toBe('[mail](mailto:a@b.co)\n\n[home](/about)\n\n[frag](#top)');
  });

  it('wraps a code span in a link rather than skipping it', () => {
    expect(
      document(block(para(text('npm i x', [{ type: 'code' }, link('https://example.com')])))),
    ).toBe('[`npm i x`](https://example.com)');
  });
});

// ── Escaping ──────────────────────────────────────────────────────────

describe('document: metacharacter escaping', () => {
  it('escapes the CommonMark inline metacharacters in literal text', () => {
    expect(document(block(para(text('a*b_c`d[e]f(g)#+-.!<>|~'))))).toBe(
      'a\\*b\\_c\\`d\\[e\\]f\\(g\\)\\#\\+\\-\\.\\!\\<\\>\\|\\~',
    );
  });

  it('escapes a leading backslash', () => {
    expect(document(block(para(text('a\\b'))))).toBe('a\\\\b');
  });

  it('exposes the same escaping as `escapeMarkdown`', () => {
    expect(escapeMarkdown('a*b')).toBe('a\\*b');
    expect(escapeMarkdown('plain text')).toBe('plain text');
    expect(escapeMarkdown('')).toBe('');
  });
});

// ── Hard break ────────────────────────────────────────────────────────

describe('document: hard break', () => {
  it('renders a hardBreak as a backslash line break', () => {
    expect(document(block(para(text('line one'), { type: 'hardBreak' }, text('line two'))))).toBe(
      'line one\\\nline two',
    );
  });
});

// ── Lists ─────────────────────────────────────────────────────────────

describe('document: lists', () => {
  it('renders consecutive bullet siblings as one bullet list', () => {
    expect(
      document(
        block(listItem('bullet', {}, para(text('one'))), listItem('bullet', {}, para(text('two')))),
      ),
    ).toBe('- one\n- two');
  });

  it('renders a default (kind-less) list as a bullet list', () => {
    expect(document(block({ type: 'list', content: [para(text('plain'))] }))).toBe('- plain');
  });

  it('renders a toggle list as a bullet (Markdown has no toggle)', () => {
    expect(document(block(listItem('toggle', {}, para(text('t')))))).toBe('- t');
  });

  it('numbers each ordered item from its own `order` plus its position, defaulting to 1', () => {
    // Each item's marker is `(item.order ?? 1) + index`: the first carries
    // `order: 5` (→ 5), the second has no `order` so falls to 1 and adds its
    // index 1 (→ 2). The list run does not thread a shared counter.
    expect(
      document(
        block(
          listItem('ordered', { order: 5 }, para(text('a'))),
          listItem('ordered', {}, para(text('b'))),
        ),
      ),
    ).toBe('5. a\n2. b');
  });

  it('numbers a uniform ordered list 1, 2, 3 from index alone', () => {
    expect(
      document(
        block(
          listItem('ordered', {}, para(text('a'))),
          listItem('ordered', {}, para(text('b'))),
          listItem('ordered', {}, para(text('c'))),
        ),
      ),
    ).toBe('1. a\n2. b\n3. c');
  });

  it('renders task list checkbox state', () => {
    expect(
      document(
        block(
          listItem('task', { checked: true }, para(text('done'))),
          listItem('task', { checked: false }, para(text('todo'))),
        ),
      ),
    ).toBe('- [x] done\n- [ ] todo');
  });

  it('indents a nested sub-list under its parent item', () => {
    expect(
      document(
        block(
          listItem('bullet', {}, para(text('parent')), listItem('bullet', {}, para(text('child')))),
        ),
      ),
    ).toBe('- parent\n  - child');
  });

  it('indents a multi-line item body to align under the marker', () => {
    // An item whose own block is multi-paragraph: continuation lines are
    // indented by the marker width so they stay inside the item.
    expect(document(block(listItem('bullet', {}, para(text('first')), para(text('second')))))).toBe(
      '- first\n\n  second',
    );
  });

  it('separates a list from following block content with a blank line', () => {
    expect(document(block(listItem('bullet', {}, para(text('item'))), para(text('after'))))).toBe(
      '- item\n\nafter',
    );
  });
});

// ── Blockquote ────────────────────────────────────────────────────────

describe('document: blockquote', () => {
  it('prefixes each line with a quote marker, blanks for empty lines', () => {
    expect(
      document(block({ type: 'blockquote', content: [para(text('first')), para(text('second'))] })),
    ).toBe('> first\n>\n> second');
  });
});

// ── Code blocks ───────────────────────────────────────────────────────

describe('document: code blocks', () => {
  it('fences a code block with its language token', () => {
    expect(
      document(
        block({ type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const x = 1;')] }),
      ),
    ).toBe('```ts\nconst x = 1;\n```');
  });

  it('renders a language-less code block with a bare fence', () => {
    expect(document(block({ type: 'codeBlock', content: [text('plain')] }))).toBe(
      '```\nplain\n```',
    );
  });

  it('strips newlines and backticks from the language token', () => {
    expect(
      document(
        block({ type: 'codeBlock', attrs: { language: 'j`s\nx' }, content: [text('code')] }),
      ),
    ).toBe('```jsx\ncode\n```');
  });

  it('ignores a non-text child inside a code block', () => {
    expect(
      document(
        block({ type: 'codeBlock', content: [text('a'), { type: 'hardBreak' }, text('b')] }),
      ),
    ).toBe('```\nab\n```');
  });

  it('widens the fence past the longest embedded backtick run', () => {
    // The code contains a ``` run; the fence must be at least 4 backticks so it
    // cannot be closed early.
    expect(document(block({ type: 'codeBlock', content: [text('a ``` b')] }))).toBe(
      '````\na ``` b\n````',
    );
  });
});

// ── Horizontal rule, image ────────────────────────────────────────────

describe('document: leaf blocks', () => {
  it('renders a horizontal rule', () => {
    expect(document(block({ type: 'horizontalRule' }))).toBe('---');
  });

  it('renders a safe image and drops an unsafe one', () => {
    expect(document(block({ type: 'image', attrs: { src: ' https://cdn.example/x.png ' } }))).toBe(
      '![](https://cdn.example/x.png)',
    );
    // An unsafe src yields an empty block, dropped from the output entirely.
    expect(
      document(
        block(
          para(text('before')),
          { type: 'image', attrs: { src: 'javascript:alert(1)' } },
          para(text('after')),
        ),
      ),
    ).toBe('before\n\nafter');
  });
});

// ── Tables ────────────────────────────────────────────────────────────

describe('document: tables', () => {
  const cell = (value: string, header = false): NodeJSON => ({
    type: header ? 'tableHeaderCell' : 'tableCell',
    attrs: {},
    content: [para(text(value))],
  });

  it('renders a GitHub-flavoured pipe table with a header separator', () => {
    expect(
      document(
        block({
          type: 'table',
          content: [
            { type: 'tableRow', content: [cell('H1', true), cell('H2', true)] },
            { type: 'tableRow', content: [cell('a'), cell('b')] },
          ],
        }),
      ),
    ).toBe('| H1 | H2 |\n| --- | --- |\n| a | b |');
  });

  it('escapes pipes in cell content and collapses newlines to spaces', () => {
    // The literal `|` is first inline-escaped to `\|`, then the table cell pass
    // escapes that backslash-pipe again to `\\|`; the paragraph break collapses
    // to a single space so the cell stays on one row.
    expect(
      document(
        block({
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', attrs: {}, content: [para(text('a|b')), para(text('c'))] },
              ],
            },
          ],
        }),
      ),
    ).toBe('| a\\\\|b c |\n| --- |');
  });

  it('pads short rows out to the widest row s column count', () => {
    expect(
      document(
        block({
          type: 'table',
          content: [
            { type: 'tableRow', content: [cell('a'), cell('b')] },
            { type: 'tableRow', content: [cell('c')] },
          ],
        }),
      ),
    ).toBe('| a | b |\n| --- | --- |\n| c |  |');
  });

  it('renders an empty table (no rows) as nothing', () => {
    expect(document(block({ type: 'table', content: [] }))).toBe('');
  });
});

// ── Fallbacks & empties ───────────────────────────────────────────────

describe('document: fallbacks', () => {
  it('falls back to inline text for an unknown block node', () => {
    // An unrecognised node type isn't silently dropped — its inline text is
    // emitted so content survives.
    expect(document(block({ type: 'callout', content: [text('kept text')] }))).toBe('kept text');
  });

  it('returns the empty string for an empty or content-less document', () => {
    expect(document(block())).toBe('');
    expect(document({ type: 'blockDocument' } as unknown as DocumentJSON)).toBe('');
  });

  it('skips an inline node with no serialiser', () => {
    // A stray inline node the serialiser doesn't recognise contributes nothing.
    expect(document(block(para(text('a'), { type: 'emoji', attrs: {} }, text('b'))))).toBe('ab');
  });

  it('skips a text node missing its text field', () => {
    expect(document(block(para({ type: 'text' }, text('kept'))))).toBe('kept');
  });
});

// ── The inline document entry point ───────────────────────────────────

describe('inline', () => {
  it('renders inline content with marks on a single line', () => {
    expect(toMarkdown.inline(inline(text('Hello '), text('world', [{ type: 'bold' }])))).toBe(
      'Hello **world**',
    );
  });

  it('trims leading/trailing whitespace', () => {
    expect(toMarkdown.inline(inline(text('  spaced  ')))).toBe('spaced');
  });

  it('returns the empty string for empty inline content', () => {
    expect(toMarkdown.inline(inline())).toBe('');
  });
});

// ── mention (opt-in) ──────────────────────────────────────────────────

describe('mentionMarkdown', () => {
  const mention = (attrs: Record<string, unknown>): NodeJSON => ({ type: 'mention', attrs });

  it('renders a mention as its @label', () => {
    expect(extended.document(block(para(text('hi '), mention({ id: 'u1', label: 'rosa' }))))).toBe(
      'hi @rosa',
    );
  });

  it('escapes the label so a display name cannot open emphasis', () => {
    expect(extended.document(block(para(mention({ id: 'u1', label: 'a*b' }))))).toBe('@a\\*b');
  });

  it('renders a bare @ when the label is missing or not a string', () => {
    expect(extended.document(block(para(mention({ id: 'u1' }))))).toBe('@');
    expect(extended.document(block(para(mention({ id: 'u1', label: 7 }))))).toBe('@');
  });

  it('contributes nothing when the serialiser is not wired in', () => {
    expect(document(block(para(text('hi '), mention({ id: 'u1', label: 'rosa' }))))).toBe('hi');
  });
});

// ── figure (opt-in) ───────────────────────────────────────────────────

describe('figureMarkdown', () => {
  const figure = (...content: ReadonlyArray<NodeJSON>): NodeJSON => ({ type: 'figure', content });
  const image = (src: string): NodeJSON => ({ type: 'image', attrs: { src } });
  const figcaption = (...content: ReadonlyArray<NodeJSON>): NodeJSON => ({
    type: 'figcaption',
    content,
  });

  it('renders the image line then the caption as an italic paragraph', () => {
    expect(
      extended.document(
        block(figure(image('https://cdn.example/x.png'), figcaption(text('A rose')))),
      ),
    ).toBe('![](https://cdn.example/x.png)\n_A rose_');
  });

  it('renders the image alone when there is no caption', () => {
    expect(extended.document(block(figure(image('https://cdn.example/x.png'))))).toBe(
      '![](https://cdn.example/x.png)',
    );
  });

  it('renders the image alone when the caption is empty', () => {
    expect(extended.document(block(figure(image('https://cdn.example/x.png'), figcaption())))).toBe(
      '![](https://cdn.example/x.png)',
    );
  });

  it('keeps the caption when the image src is unsafe', () => {
    expect(
      extended.document(block(figure(image('javascript:alert(1)'), figcaption(text('A rose'))))),
    ).toBe('_A rose_');
  });

  it('escapes and styles the caption s inline content', () => {
    expect(
      extended.document(
        block(
          figure(
            image('/x.png'),
            figcaption(text('a*b '), text('emphasised', [{ type: 'italic' }])),
          ),
        ),
      ),
    ).toBe('![](/x.png)\n_a\\*b *emphasised*_');
  });

  it('renders nothing for an empty figure', () => {
    expect(extended.document(block(figure()))).toBe('');
  });
});

// ── sidenote (opt-in) ─────────────────────────────────────────────────

describe('sidenoteMarkdown', () => {
  it('serialises a sidenote as a `^[…]` inline footnote in place', () => {
    expect(
      extended.document(
        block(
          para(text('Body'), { type: 'sidenote', content: [text('an aside')] }, text(' goes on')),
        ),
      ),
    ).toBe('Body^[an aside] goes on');
  });

  it('keeps rich inline content (link + emphasis + code) inside the footnote', () => {
    expect(
      extended.document(
        block(
          para(text('Body'), {
            type: 'sidenote',
            content: [
              text('see '),
              text('the source', [{ type: 'italic' }, link('https://example.com')]),
              text(' and '),
              text('code', [{ type: 'code' }]),
            ],
          }),
        ),
      ),
    ).toBe('Body^[see [*the source*](https://example.com) and `code`]');
  });

  it('escapes brackets inside a sidenote so they cannot close the note early', () => {
    expect(extended.document(block(para({ type: 'sidenote', content: [text('a [b] *c*')] })))).toBe(
      '^[a \\[b\\] \\*c\\*]',
    );
  });

  it('collapses a hard break inside a sidenote to a space', () => {
    expect(
      extended.document(
        block(
          para({
            type: 'sidenote',
            content: [text('line one'), { type: 'hardBreak' }, text('line two')],
          }),
        ),
      ),
    ).toBe('^[line one line two]');
  });

  it('flattens a stray nested sidenote rather than emitting `^[…^[…]…]`', () => {
    expect(
      extended.document(
        block(
          para({
            type: 'sidenote',
            content: [text('outer '), { type: 'sidenote', content: [text('inner')] }],
          }),
        ),
      ),
    ).toBe('^[outer inner]');
  });

  it('drops an empty or content-less sidenote', () => {
    expect(extended.document(block(para({ type: 'sidenote', content: [] })))).toBe('');
    expect(extended.document(block(para({ type: 'sidenote' })))).toBe('');
  });
});

// ── createMarkdownSerialiser: the extension seam ──────────────────────

describe('createMarkdownSerialiser', () => {
  it('adds an application block node without restating the stock cases', () => {
    const withFlowchart = createMarkdownSerialiser({
      blocks: { flowchart: () => '_[flowchart diagram]_' },
    });
    expect(withFlowchart.document(block({ type: 'flowchart', attrs: { data: {} } }))).toBe(
      '_[flowchart diagram]_',
    );
    expect(withFlowchart.document(block(para(text('still stock'))))).toBe('still stock');
  });

  it('lets an application replace a stock block serialiser', () => {
    const noRules = createMarkdownSerialiser({ blocks: { horizontalRule: () => '***' } });
    expect(noRules.document(block({ type: 'horizontalRule' }))).toBe('***');
  });

  it('adds a mark serialiser, applied outside the stock emphasis and inside the link', () => {
    const withHighlight = createMarkdownSerialiser({
      marks: { highlight: (value) => `==${value}==` },
    });
    expect(
      withHighlight.document(block(para(text('x', [{ type: 'highlight' }, { type: 'bold' }])))),
    ).toBe('==**x**==');
    expect(
      withHighlight.document(
        block(para(text('x', [{ type: 'highlight' }, link('https://example.com')]))),
      ),
    ).toBe('[==x==](https://example.com)');
  });

  it('hands a node serialiser the recursive passes and the escape function', () => {
    const withCallout = createMarkdownSerialiser({
      blocks: {
        callout: (node, context) => `> [!NOTE]\n> ${context.serialiseBlocks(node.content ?? [])}`,
      },
      inlines: { token: (node, context) => context.escape(String(node.attrs?.value ?? '')) },
    });
    expect(
      withCallout.document(
        block({
          type: 'callout',
          content: [para(text('see '), { type: 'token', attrs: { value: 'a*b' } })],
        }),
      ),
    ).toBe('> [!NOTE]\n> see a\\*b');
  });

  it('leaves the default instance untouched', () => {
    createMarkdownSerialiser({ blocks: { horizontalRule: () => '***' } });
    expect(document(block({ type: 'horizontalRule' }))).toBe('---');
  });
});
