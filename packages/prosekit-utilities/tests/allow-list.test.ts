/**
 * Unit tests for the allow-list walk.
 *
 * `allowListViolation` walks an already shape-valid document and reports the
 * first node or mark type outside the surface's vocabulary, or an unsafe
 * `link` `href`. The fixtures are the two source applications' comment,
 * post, article-section and title allow-lists, rebuilt here with
 * `defineAllowList` — the library ships the machinery, an application ships
 * the vocabularies.
 *
 * @module
 */

import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import * as Order from 'effect/Order';
import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';
import { assert, describe, expect, it } from 'vite-plus/test';
import {
  allowListFilter,
  allowListViolation,
  checkAllowList,
  defineAllowList,
  DocumentViolation,
} from '../src/allow-list.ts';
import type { DocumentJSON, MarkJSON, NodeJSON } from '../src/json.ts';

// ── The four vocabularies the source applications ship ────────────────

const INLINE_MARKS = ['bold', 'italic', 'strike', 'code', 'link'];

const COMMENT = defineAllowList({
  label: 'a comment',
  nodes: ['paragraph', 'text', 'hardBreak'],
  marks: INLINE_MARKS,
});

const POST = defineAllowList({
  label: 'a post',
  nodes: [
    'paragraph',
    'text',
    'hardBreak',
    'heading',
    'list',
    'blockquote',
    'codeBlock',
    'image',
    'mention',
  ],
  marks: INLINE_MARKS,
});

const ARTICLE = defineAllowList({
  label: 'an article section',
  nodes: [
    ...POST.nodes,
    'horizontalRule',
    'table',
    'tableRow',
    'tableCell',
    'tableHeaderCell',
    'figure',
    'figcaption',
  ],
  marks: [...INLINE_MARKS, 'underline', 'highlight', 'subscript', 'superscript', 'citation'],
});

const TITLE = defineAllowList({
  label: 'a title',
  nodes: ['text', 'hardBreak'],
  marks: [...INLINE_MARKS, 'subscript', 'superscript'],
});

const paragraph = (text: string, marks: ReadonlyArray<MarkJSON> = []): DocumentJSON => ({
  type: 'blockDocument',
  content: [
    {
      type: 'paragraph',
      content: [
        Arr.match(marks, {
          onEmpty: (): NodeJSON => ({ type: 'text', text }),
          onNonEmpty: (nonEmpty): NodeJSON => ({ type: 'text', text, marks: nonEmpty }),
        }),
      ],
    },
  ],
});

/**
 * A stored-row value the envelope type rules out (a `null` entry, a node
 * missing its `type`, a non-array `marks`), typed as a document on purpose:
 * the walk runs on values only proved to be JSON, so these are reachable.
 */
const malformed = (value: Schema.Json): DocumentJSON =>
  // SAFETY: deliberately ill-typed input is the point of every caller.
  value as DocumentJSON;

/** The violation's message, if there is one. */
const message = (
  allowList: Parameters<typeof allowListViolation>[0],
  doc: DocumentJSON,
): Option.Option<string> =>
  Option.map(allowListViolation(allowList, doc), (violation) => violation.message);

// ── defineAllowList ───────────────────────────────────────────────────

describe('defineAllowList', () => {
  it('accepts any iterable of names and stores them as HashSets', () => {
    const list = defineAllowList({
      label: 'a thing',
      nodes: HashSet.make('text', 'paragraph'),
      marks: ['bold'],
    });
    expect(HashSet.has(list.nodes, 'text')).toBe(true);
    expect(HashSet.has(list.nodes, 'paragraph')).toBe(true);
    expect(HashSet.has(list.marks, 'bold')).toBe(true);
    expect(HashSet.has(list.marks, 'italic')).toBe(false);
  });

  it('deduplicates repeated names', () => {
    const list = defineAllowList({ label: 'x', nodes: ['text', 'text'], marks: [] });
    expect(HashSet.size(list.nodes)).toBe(1);
  });

  it('defaults checkLinkHref to true', () => {
    expect(defineAllowList({ label: 'x', nodes: [], marks: [] }).checkLinkHref).toBe(true);
  });

  it('honours an explicit checkLinkHref: false', () => {
    const lax = defineAllowList({
      label: 'a lax surface',
      nodes: ['paragraph', 'text'],
      marks: ['link'],
      checkLinkHref: false,
    });
    expect(lax.checkLinkHref).toBe(false);
    const doc = paragraph('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]);
    expect(message(lax, doc)).toEqual(Option.none());
    // The same document under a checking list is a violation.
    expect(message(COMMENT, doc)).toEqual(Option.some(expect.any(String)));
  });

  it('carries the four documented vocabularies', () => {
    expect(Arr.sort([...COMMENT.nodes], Order.String)).toEqual(['hardBreak', 'paragraph', 'text']);
    expect(Arr.sort([...COMMENT.marks], Order.String)).toEqual([
      'bold',
      'code',
      'italic',
      'link',
      'strike',
    ]);
  });
});

// ── The node allow-list ───────────────────────────────────────────────

describe('allowListViolation: node allow-list', () => {
  it('passes a plain paragraph document', () => {
    expect(Option.isNone(allowListViolation(COMMENT, paragraph('hello world')))).toBe(true);
  });

  it('passes an empty document (no content)', () => {
    expect(message(COMMENT, { type: 'blockDocument', content: [] })).toEqual(Option.none());
  });

  it('passes a hardBreak between two text runs', () => {
    const doc: DocumentJSON = {
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'line one' },
            { type: 'hardBreak' },
            { type: 'text', text: 'line two' },
          ],
        },
      ],
    };
    expect(message(COMMENT, doc)).toEqual(Option.none());
  });

  it.each([
    'heading',
    'image',
    'table',
    'codeBlock',
    'figure',
    'mention',
    'list',
    'flowchart',
    'sidenote',
  ])('flags a "%s" node as a violation', (nodeType) => {
    const doc: DocumentJSON = { type: 'blockDocument', content: [{ type: nodeType }] };
    expect(message(COMMENT, doc)).toEqual(Option.some(expect.stringContaining(nodeType)));
  });

  it('names the specific disallowed node type in the violation message', () => {
    const doc: DocumentJSON = { type: 'blockDocument', content: [{ type: 'horizontalRule' }] };
    expect(message(COMMENT, doc)).toEqual(Option.some(expect.stringContaining('horizontalRule')));
  });

  it('reports the violation as structured data, not only a string', () => {
    const doc: DocumentJSON = { type: 'blockDocument', content: [{ type: 'heading' }] };
    const violation = allowListViolation(COMMENT, doc);
    expect(Option.isSome(violation)).toBe(true);
    assert(Option.isSome(violation));
    const value = violation.value;
    expect(value).toBeInstanceOf(DocumentViolation);
    expect(value._tag).toBe('DocumentViolation');
    expect(value.kind).toBe('node');
    expect(value.name).toBe('heading');
    expect(value.label).toBe('a comment');
    expect(value.message).toBe('node type "heading" is not permitted in a comment');
  });
});

// ── The mark allow-list ───────────────────────────────────────────────

describe('allowListViolation: mark allow-list', () => {
  it.each(['bold', 'italic', 'strike', 'code'])('passes the "%s" mark', (mark) => {
    expect(message(COMMENT, paragraph('styled', [{ type: mark }]))).toEqual(Option.none());
  });

  it.each(['underline', 'highlight', 'subscript', 'superscript'])(
    'flags the "%s" mark as a violation',
    (mark) => {
      expect(message(COMMENT, paragraph('styled', [{ type: mark }]))).toEqual(
        Option.some(expect.stringContaining(mark)),
      );
    },
  );

  it('reports a mark violation with kind "mark"', () => {
    const found = allowListViolation(COMMENT, paragraph('x', [{ type: 'highlight' }]));
    assert(Option.isSome(found));
    const violation = found.value;
    expect(violation.kind).toBe('mark');
    expect(violation.name).toBe('highlight');
  });
});

// ── Link href safety ──────────────────────────────────────────────────

describe('allowListViolation: link href safety', () => {
  it('passes an https link', () => {
    const doc = paragraph('a link', [{ type: 'link', attrs: { href: 'https://example.com' } }]);
    expect(message(COMMENT, doc)).toEqual(Option.none());
  });

  it('passes a mailto: link', () => {
    const doc = paragraph('a link', [{ type: 'link', attrs: { href: 'mailto:a@b.test' } }]);
    expect(message(COMMENT, doc)).toEqual(Option.none());
  });

  it('flags a javascript: link as a violation', () => {
    const doc = paragraph('a link', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]);
    expect(message(COMMENT, doc)).toEqual(Option.some(expect.any(String)));
  });

  it('flags a data: link as a violation', () => {
    const doc = paragraph('a link', [
      { type: 'link', attrs: { href: 'data:text/html,<script>1</script>' } },
    ]);
    expect(message(COMMENT, doc)).toEqual(Option.some(expect.any(String)));
  });

  it('reports an href violation with kind "href" and the link mark s name', () => {
    const found = allowListViolation(
      COMMENT,
      paragraph('x', [{ type: 'link', attrs: { href: 'javascript:1' } }]),
    );
    assert(Option.isSome(found));
    const violation = found.value;
    expect(violation.kind).toBe('href');
    expect(violation.name).toBe('link');
    expect(violation.message).toBe('link href is not a permitted URL scheme');
  });
});

describe('allowListViolation: obfuscated dangerous schemes', () => {
  // The realistic bypass shapes for an allow-list over untrusted input. All
  // of these SHOULD already be rejected — `isSafeHref` parses with `new URL()`
  // and lowercases `protocol`, and the WHATWG URL parser strips leading/inner
  // ASCII whitespace and control characters from a scheme before it resolves.
  // These cases exist to PIN that normalisation: a future "optimisation" that
  // swaps the URL parse for a `startsWith("javascript:")` string test would
  // still pass the plain-`javascript:` case above while silently reopening
  // every variant below.
  const dangerous = [
    // Case variation — defeats a case-sensitive string compare.
    ['mixed case', 'JaVaScRiPt:alert(1)'],
    ['upper case', 'JAVASCRIPT:alert(1)'],
    // Leading whitespace — defeats a compare that forgets to trim.
    ['leading spaces', '  javascript:alert(1)'],
    ['leading tab', '\tjavascript:alert(1)'],
    ['leading newline', '\njavascript:alert(1)'],
    ['leading spaces + mixed case', '  JaVaScRiPt:alert(1)'],
    // Whitespace/control characters INSIDE the scheme — the classic filter
    // bypass, since the URL parser strips them but a naive compare doesn't.
    ['tab inside scheme', 'java\tscript:alert(1)'],
    ['newline inside scheme', 'java\nscript:alert(1)'],
    ['carriage return inside scheme', 'java\rscript:alert(1)'],
    ['NUL inside scheme', 'java script:alert(1)'],
    // Other executable / non-fetch schemes.
    ['vbscript', 'vbscript:msgbox(1)'],
    ['vbscript mixed case + padding', '  VbScRiPt:msgbox(1)'],
    ['data with base64 payload', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['file', 'file:///etc/passwd'],
    // Protocol-relative — not a scheme, but resolves off-origin, which is why
    // `isSafeHref`'s root-relative branch explicitly excludes `//`.
    ['protocol-relative', '//evil.example/x'],
    ['backslash-escaped root', '/\\evil.example/x'],
  ] as const;

  it.each(dangerous)('rejects %s: %j', (_label, href) => {
    expect(message(COMMENT, paragraph('a link', [{ type: 'link', attrs: { href } }]))).toEqual(
      Option.some(expect.any(String)),
    );
  });

  // Guards against over-correcting into rejecting legitimate links. Table-
  // driven for the same reason the dangerous cases are: a single `it`
  // looping over these short-circuits on the first failure, so a `mailto:`
  // regression would hide whether the rest still pass.
  const safe = [
    ['https with query and fragment', 'https://example.com/a?b=c#d'],
    ['http', 'http://example.com'],
    ['upper-case scheme and host', 'HTTPS://EXAMPLE.COM'],
    ['surrounding whitespace', '  https://example.com  '],
    ['mailto', 'mailto:a@b.test'],
    ['root-relative', '/root-relative'],
    ['bare fragment', '#fragment'],
  ] as const;

  it.each(safe)('still accepts %s: %j', (_label, href) => {
    expect(message(COMMENT, paragraph('a link', [{ type: 'link', attrs: { href } }]))).toEqual(
      Option.none(),
    );
  });
});

// ── Nesting and document order ────────────────────────────────────────

describe('allowListViolation: nested violation detection', () => {
  it('catches a disallowed node type nested inside an otherwise-safe tree', () => {
    // Not a realistic ProseMirror shape (paragraphs don't nest), but proves
    // the recursive walk isn't shallow — a violation anywhere in the tree
    // must be caught, not just at the top level.
    const doc: DocumentJSON = {
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'image', attrs: { src: 'https://evil.example/x.png' } }],
        },
      ],
    };
    expect(message(COMMENT, doc)).toEqual(Option.some(expect.any(String)));
  });

  it('names the earliest offender in document order', () => {
    const doc: DocumentJSON = {
      type: 'blockDocument',
      content: [{ type: 'heading' }, { type: 'table' }],
    };
    expect(message(COMMENT, doc)).toEqual(Option.some(expect.stringContaining('heading')));
  });

  it('reports a malformed entry as a violation rather than throwing', () => {
    // The walk runs on values the structural check has only proved to be
    // JSON, so a `null`, a stray string or a node missing its `type` is
    // reachable. None of them is in any vocabulary.
    Arr.forEach([null, 'a stray string', 42, { attrs: {} }, { type: 7 }], (entry) => {
      const doc = malformed({ type: 'blockDocument', content: [entry] });
      expect(message(COMMENT, doc)).toEqual(
        Option.some('node type "" is not permitted in a comment'),
      );
    });
  });

  it('reports a malformed mark as a violation rather than throwing', () => {
    const doc = malformed({
      type: 'blockDocument',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [null] }] }],
    });
    expect(message(COMMENT, doc)).toEqual(
      Option.some('mark type "" is not permitted in a comment'),
    );
  });

  it('ignores a `marks` or `content` field that is not an array', () => {
    const doc = malformed({
      type: 'blockDocument',
      content: [{ type: 'paragraph', marks: 'nope', content: 'nope' }],
    });
    expect(message(COMMENT, doc)).toEqual(Option.none());
  });

  it('reports a node violation before a mark violation on the same node', () => {
    const doc: DocumentJSON = {
      type: 'blockDocument',
      content: [{ type: 'heading', marks: [{ type: 'highlight' }] }],
    };
    expect(message(COMMENT, doc)).toEqual(Option.some(expect.stringContaining('heading')));
  });
});

// ── The other three vocabularies ──────────────────────────────────────

describe('post / article / title vocabularies', () => {
  it('a post admits structure and mentions but not tables, figures or citations', () => {
    const structured: DocumentJSON = {
      type: 'blockDocument',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hi' }] },
        { type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'u', label: 'rosa' } }] },
      ],
    };
    expect(message(POST, structured)).toEqual(Option.none());
    expect(message(COMMENT, structured)).toEqual(Option.some(expect.stringContaining('heading')));
    expect(message(POST, { type: 'blockDocument', content: [{ type: 'table' }] })).toEqual(
      Option.some(expect.stringContaining('table')),
    );
    expect(message(POST, { type: 'blockDocument', content: [{ type: 'figure' }] })).toEqual(
      Option.some(expect.stringContaining('figure')),
    );
    expect(
      message(POST, paragraph('cited', [{ type: 'citation', attrs: { workId: 'w' } }])),
    ).toEqual(Option.some(expect.stringContaining('citation')));
  });

  it('an article section admits tables, figures and citations', () => {
    expect(
      message(ARTICLE, {
        type: 'blockDocument',
        content: [
          { type: 'table' },
          { type: 'figure', content: [{ type: 'image' }, { type: 'figcaption' }] },
        ],
      }),
    ).toEqual(Option.none());
    expect(
      message(ARTICLE, paragraph('cited', [{ type: 'citation', attrs: { workId: 'w' } }])),
    ).toEqual(Option.none());
    expect(
      message(ARTICLE, paragraph('x', [{ type: 'link', attrs: { href: 'javascript:1' } }])),
    ).toEqual(Option.some(expect.stringContaining('URL scheme')));
  });

  it('a title is inline only and admits the scientific-name marks', () => {
    expect(
      message(TITLE, {
        type: 'inlineDocument',
        content: [
          { type: 'text', text: 'Rosa ' },
          { type: 'text', text: 'canina', marks: [{ type: 'italic' }] },
          { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
        ],
      }),
    ).toEqual(Option.none());
    expect(message(TITLE, { type: 'inlineDocument', content: [{ type: 'paragraph' }] })).toEqual(
      Option.some(expect.stringContaining('paragraph')),
    );
    expect(
      message(TITLE, {
        type: 'inlineDocument',
        content: [{ type: 'text', text: 'x', marks: [{ type: 'highlight' }] }],
      }),
    ).toEqual(Option.some(expect.stringContaining('highlight')));
  });
});

// ── checkAllowList ────────────────────────────────────────────────────

describe('checkAllowList', () => {
  const checkComment = checkAllowList(COMMENT);

  it('succeeds with the document it was given', () => {
    const doc = paragraph('hello world');
    expect(Effect.runSync(checkComment(doc))).toBe(doc);
  });

  it('fails with the tagged violation', () => {
    const doc: DocumentJSON = { type: 'blockDocument', content: [{ type: 'heading' }] };
    const result = Effect.runSync(Effect.result(checkComment(doc)));
    expect(Result.isFailure(result)).toBe(true);
    const failed = Result.getFailure(result);
    assert(Option.isSome(failed));
    const failure = failed.value;
    expect(failure).toBeInstanceOf(DocumentViolation);
    expect(failure._tag).toBe('DocumentViolation');
    expect(failure.kind).toBe('node');
    expect(failure.message).toBe('node type "heading" is not permitted in a comment');
  });

  it('is catchable by tag', () => {
    const doc: DocumentJSON = { type: 'blockDocument', content: [{ type: 'heading' }] };
    const recovered = checkComment(doc).pipe(
      Effect.catchTag('DocumentViolation', (violation) => Effect.succeed(violation.name)),
    );
    expect(Effect.runSync(recovered)).toBe('heading');
  });

  it('preserves the document type through the check', () => {
    const doc = { type: 'blockDocument', content: [], extra: 1 } as const;
    const out: typeof doc = Effect.runSync(checkComment(doc));
    expect(out.extra).toBe(1);
  });
});

// ── allowListFilter ───────────────────────────────────────────────────

describe('allowListFilter', () => {
  const Narrowed = Schema.Struct({
    type: Schema.Literal('blockDocument'),
    content: Schema.Array(Schema.Json),
  }).pipe(Schema.check(allowListFilter(COMMENT)));
  const decode = Schema.decodeUnknownSync(Narrowed);

  it('passes a document inside the vocabulary', () => {
    const doc = paragraph('hello');
    expect(decode(doc)).toEqual(doc);
  });

  it('fails with the violation s own message', () => {
    expect(() => decode({ type: 'blockDocument', content: [{ type: 'heading' }] })).toThrow(
      /node type "heading" is not permitted in a comment/,
    );
  });

  it('composes onto any schema carrying `content`, not just a document shape', () => {
    expect(() => decode(paragraph('x', [{ type: 'link', attrs: { href: 'vbscript:1' } }]))).toThrow(
      /URL scheme/,
    );
  });
});
