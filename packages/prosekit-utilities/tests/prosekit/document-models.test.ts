/**
 * Golden-fixture tests for the derived document wire schema — the single
 * Effect Schema serving both the persistence / render trust boundary and the
 * generative contract for whole-document machine emission.
 *
 * Every node type, every mark, and every overlaid attribute (heading level,
 * list kind and order, image source and size, code-block language, table cell
 * colwidth, mention id and label) is exercised at least once. Two cases carry
 * more weight than the rest, because they need the derived **content model**
 * to be right rather than just registry membership:
 *
 * - `sidenote`, whose content is `(text | hardBreak)*`, so a nested sidenote
 *   must be rejected — derivation gets that from the compiled `ContentMatch`
 *   automaton, with no overlay entry;
 * - the `+`-cardinality content fields, which must reject an empty array at
 *   every depth, not only at the top level.
 *
 * These fixtures are the compatibility gate: a change to a node spec, a mark
 * spec or the overlay that breaks one of them changes what already-stored
 * documents decode as, and is a major version.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import * as Schema from 'effect/Schema';
import { createDocumentFixture } from './fixture.ts';

const { block, inline } = createDocumentFixture();

const decodeBlock = Schema.decodeUnknownSync(block.Document);
const decodeInline = Schema.decodeUnknownSync(inline.Document);

describe('block document: golden-fixture node/mark coverage', () => {
  it('decodes a document exercising every block node and every mark', () => {
    const doc = {
      type: 'blockDocument',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'plain ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
            { type: 'text', text: 'underline', marks: [{ type: 'underline' }] },
            { type: 'text', text: 'strike', marks: [{ type: 'strike' }] },
            { type: 'text', text: 'code', marks: [{ type: 'code' }] },
            { type: 'text', text: 'highlight', marks: [{ type: 'highlight' }] },
            { type: 'text', text: 'sub', marks: [{ type: 'subscript' }] },
            { type: 'text', text: 'sup', marks: [{ type: 'superscript' }] },
            {
              type: 'text',
              text: 'cited',
              marks: [{ type: 'citation', attrs: { workId: 'w-1' } }],
            },
            {
              type: 'text',
              text: 'link',
              marks: [
                { type: 'link', attrs: { href: 'https://example.com', target: null, rel: null } },
              ],
            },
            { type: 'hardBreak' },
            { type: 'mention', attrs: { id: 'u-1', label: 'rosa' } },
            {
              type: 'sidenote',
              content: [
                { type: 'text', text: 'aside ' },
                { type: 'text', text: 'linked', marks: [{ type: 'link', attrs: { href: '/x' } }] },
              ],
            },
          ],
        },
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quoted' }] }],
        },
        {
          type: 'list',
          attrs: { kind: 'bullet' },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'bullet' }] },
            {
              type: 'list',
              attrs: { kind: 'ordered', order: 3 },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested ordered' }] }],
            },
          ],
        },
        {
          type: 'list',
          attrs: { kind: 'task', checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }],
        },
        {
          type: 'list',
          attrs: { kind: 'toggle', collapsed: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'toggle' }] }],
        },
        { type: 'image', attrs: { src: 'https://example.com/a.png', width: 100, height: 50 } },
        { type: 'image', attrs: { src: null, width: null, height: null } },
        { type: 'horizontalRule' },
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [{ type: 'text', text: 'const x = 1;' }],
        },
        {
          type: 'figure',
          content: [
            {
              type: 'image',
              attrs: { src: 'https://example.com/b.png', width: null, height: null },
            },
            { type: 'figcaption', content: [{ type: 'text', text: 'A caption' }] },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeaderCell',
                  attrs: { colspan: 2, rowspan: 1, colwidth: [100, 200] },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H' }] }],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cell' }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(decodeBlock(doc)).toEqual(doc);
    expect(block.is(doc)).toBe(true);
  });

  it('rejects an empty top-level content array (block+ is non-empty)', () => {
    expect(() => decodeBlock({ type: 'blockDocument', content: [] })).toThrow();
    expect(block.is({ type: 'blockDocument', content: [] })).toBe(false);
  });

  it('rejects empty content on nested block+/tableRow+ nodes, not just the top level', () => {
    // The derivation's `Schema.NonEmptyArray` applies to every `+`-cardinality
    // content field it builds, not only the document's own — so blockquote,
    // list, table, tableCell and tableHeaderCell are all non-empty-enforced.
    const emptyBlockquote = {
      type: 'blockDocument',
      content: [{ type: 'blockquote', content: [] }],
    };
    const emptyList = {
      type: 'blockDocument',
      content: [{ type: 'list', attrs: { kind: 'bullet' }, content: [] }],
    };
    const emptyTable = { type: 'blockDocument', content: [{ type: 'table', content: [] }] };
    const emptyTableCell = {
      type: 'blockDocument',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [{ type: 'tableCell', attrs: {}, content: [] }],
            },
          ],
        },
      ],
    };
    expect(() => decodeBlock(emptyBlockquote)).toThrow();
    expect(() => decodeBlock(emptyList)).toThrow();
    expect(() => decodeBlock(emptyTable)).toThrow();
    expect(() => decodeBlock(emptyTableCell)).toThrow();
  });

  it('rejects a missing content key', () => {
    expect(() => decodeBlock({ type: 'blockDocument' })).toThrow();
    expect(block.is({ type: 'blockDocument' })).toBe(false);
  });

  it('rejects a wrong envelope type and non-object values', () => {
    expect(() => decodeBlock({ type: 'inlineDocument', content: [] })).toThrow();
    expect(() => decodeBlock(null)).toThrow();
    expect(() => decodeBlock('nope')).toThrow();
    expect(block.is(null)).toBe(false);
  });

  it('rejects a document carrying an unknown node type', () => {
    expect(() =>
      decodeBlock({ type: 'blockDocument', content: [{ type: 'notARealNode' }] }),
    ).toThrow();
  });

  it('rejects an out-of-range heading level (attribute overlay)', () => {
    expect(() =>
      decodeBlock({
        type: 'blockDocument',
        content: [{ type: 'heading', attrs: { level: 9 }, content: [] }],
      }),
    ).toThrow();
  });

  it('rejects an unknown list kind (attribute overlay)', () => {
    expect(() =>
      decodeBlock({
        type: 'blockDocument',
        content: [
          {
            type: 'list',
            attrs: { kind: 'not-a-kind' },
            content: [{ type: 'paragraph', content: [] }],
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects a sidenote nested inside a sidenote (content model, not just registry membership)', () => {
    // The sidenote's content is `(text | hardBreak)*`, so the live editor can
    // never construct a nested sidenote — a nested inline footnote has no
    // valid Markdown rendering. Derivation walks the compiled `ContentMatch`
    // automaton for that exact expression, so it excludes `sidenote` from the
    // admissible child set with no overlay needed.
    const doc = {
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'sidenote',
              content: [{ type: 'text', text: 'outer ' }, { type: 'sidenote' }],
            },
          ],
        },
      ],
    };
    expect(() => decodeBlock(doc)).toThrow();
    expect(block.is(doc)).toBe(false);
  });

  it('decodes an empty sidenote (just inserted)', () => {
    const doc = {
      type: 'blockDocument',
      content: [{ type: 'paragraph', content: [{ type: 'sidenote' }] }],
    };
    expect(decodeBlock(doc)).toEqual(doc);
    expect(block.is(doc)).toBe(true);
  });

  it('admits a figure holding only an image — derivation recovers the child set, not the sequence', () => {
    // A deliberate, documented limit of the derivation: it reads the
    // admissible child TYPES and the `+`/`*` cardinality off the compiled
    // `ContentMatch`, so `content: "image figcaption"` derives as "one or more
    // of image | figcaption". Ordering and arity within a sequence are the one
    // thing the derived wire schema is weaker than ProseMirror's own parser
    // about; the editor can still never construct this, and an application
    // that needs the pair enforced at the wire adds its own check.
    const doc = {
      type: 'blockDocument',
      content: [
        {
          type: 'figure',
          content: [{ type: 'image', attrs: { src: null, width: null, height: null } }],
        },
      ],
    };
    expect(decodeBlock(doc)).toEqual(doc);
  });

  it('admits a figure holding only a figcaption, and the two halves reordered — same limit', () => {
    const image = { type: 'image', attrs: { src: null, width: null, height: null } };
    const caption = { type: 'figcaption', content: [{ type: 'text', text: 'A caption' }] };
    const captionOnly = {
      type: 'blockDocument',
      content: [{ type: 'figure', content: [caption] }],
    };
    const reordered = {
      type: 'blockDocument',
      content: [{ type: 'figure', content: [caption, image] }],
    };
    expect(decodeBlock(captionOnly)).toEqual(captionOnly);
    expect(decodeBlock(reordered)).toEqual(reordered);
  });

  it('rejects a figure carrying a block inside its caption', () => {
    expect(() =>
      decodeBlock({
        type: 'blockDocument',
        content: [
          {
            type: 'figure',
            content: [
              { type: 'image', attrs: { src: null, width: null, height: null } },
              {
                type: 'figcaption',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'no' }] }],
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  describe('required(...) attribute overlay entries stay required', () => {
    // ProseMirror's own rule makes ANY attribute with a `default` an omissible
    // key — including heading.level, list.kind, image.src/width/height,
    // codeBlock.language and the mention's id/label, all of which declare one.
    // The overlay wraps each in `required(...)` so a machine-authored document
    // cannot skip the value it was supposed to specify; these pin that the
    // wrapper takes effect (a missing overlay entry, or one that forgot
    // `required(...)`, would silently let these decode).
    it('rejects a heading missing attrs.level', () => {
      const doc = {
        type: 'blockDocument',
        content: [{ type: 'heading', attrs: {}, content: [] }],
      };
      expect(() => decodeBlock(doc)).toThrow();
      expect(block.is(doc)).toBe(false);
    });

    it('rejects a list missing attrs.kind', () => {
      const doc = {
        type: 'blockDocument',
        content: [{ type: 'list', attrs: {}, content: [{ type: 'paragraph', content: [] }] }],
      };
      expect(() => decodeBlock(doc)).toThrow();
    });

    it('rejects an image missing attrs.src/width/height', () => {
      expect(() =>
        decodeBlock({ type: 'blockDocument', content: [{ type: 'image', attrs: {} }] }),
      ).toThrow();
    });

    it('rejects a codeBlock missing attrs.language', () => {
      expect(() =>
        decodeBlock({ type: 'blockDocument', content: [{ type: 'codeBlock', attrs: {} }] }),
      ).toThrow();
    });

    it('rejects a mention missing attrs.id or attrs.label', () => {
      const missingBoth = {
        type: 'blockDocument',
        content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: {} }] }],
      };
      const missingLabel = {
        type: 'blockDocument',
        content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'u-1' } }] }],
      };
      expect(() => decodeBlock(missingBoth)).toThrow();
      expect(() => decodeBlock(missingLabel)).toThrow();
      expect(block.is(missingLabel)).toBe(false);
    });

    it('rejects a mention whose id is not a string', () => {
      expect(() =>
        decodeBlock({
          type: 'blockDocument',
          content: [
            { type: 'paragraph', content: [{ type: 'mention', attrs: { id: 7, label: 'x' } }] },
          ],
        }),
      ).toThrow();
    });
  });
});

describe('inline document: golden-fixture coverage', () => {
  it('decodes a representative inline document', () => {
    const doc = {
      type: 'inlineDocument',
      content: [
        { type: 'text', text: 'A ' },
        { type: 'text', text: 'title', marks: [{ type: 'italic' }] },
      ],
    };
    expect(decodeInline(doc)).toEqual(doc);
    expect(inline.is(doc)).toBe(true);
  });

  it('accepts empty content (inline* permits zero children)', () => {
    const doc = { type: 'inlineDocument', content: [] };
    expect(decodeInline(doc)).toEqual(doc);
    expect(inline.is(doc)).toBe(true);
  });

  it('rejects a block document and node types the inline grammar does not register', () => {
    expect(() =>
      decodeInline({ type: 'blockDocument', content: [{ type: 'paragraph', content: [] }] }),
    ).toThrow();
    expect(() =>
      decodeInline({ type: 'inlineDocument', content: [{ type: 'hardBreak' }] }),
    ).toThrow();
    expect(() =>
      decodeInline({
        type: 'inlineDocument',
        content: [{ type: 'mention', attrs: { id: 'u-1', label: 'rosa' } }],
      }),
    ).toThrow();
    expect(inline.is({ type: 'blockDocument', content: [] })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(inline.is('string')).toBe(false);
    expect(inline.is(42)).toBe(false);
    expect(inline.is(undefined)).toBe(false);
  });
});

describe('document schemas: JSON canonical codec (toCodecJson)', () => {
  it('passes a block document through the JSON codec unchanged in both directions', () => {
    // A wire transport materialises this codec for payloads; a derived
    // (non-`declare`) schema composes `toCodecJson` automatically through its
    // struct/union graph, with no passthrough annotation needed.
    const codec = Schema.toCodecJson(block.Document);
    const doc = {
      type: 'blockDocument',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'wire' }] }],
    };
    const encoded = Schema.encodeUnknownSync(codec)(doc);
    expect(encoded).toEqual(doc);
    expect(Schema.decodeUnknownSync(codec)(encoded)).toEqual(doc);
  });

  it('passes an inline document through its JSON codec unchanged', () => {
    const codec = Schema.toCodecJson(inline.Document);
    const doc = { type: 'inlineDocument', content: [{ type: 'text', text: 't' }] };
    expect(Schema.encodeUnknownSync(codec)(doc)).toEqual(doc);
    expect(Schema.decodeUnknownSync(codec)(doc)).toEqual(doc);
  });
});

describe('document schemas: JSON Schema generation (generative-contract use case)', () => {
  it('produces a JSON Schema document for the block schema without throwing', () => {
    // Smoke test for the generative-contract claim: recursive `Schema.suspend`
    // graphs need `$ref` / `$defs` support from `toJsonSchemaDocument`. Not a
    // full snapshot — the shape is exercised by decode above.
    expect(Schema.toJsonSchemaDocument(block.Document)).toBeTruthy();
  });
});
