import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';
import { describe, expect, it } from 'vite-plus/test';
import {
  attributeOverlay,
  createRegistryCache,
  deriveDocumentSchema,
  deriveDocumentSchemas,
  deriveMarkSchema,
  deriveNodeSchema,
  Registry,
} from '../../src/derive/index.ts';
import { figureTestSchema, inlineTestSchema, testSchema } from './fixture.ts';

const decodes = (schema: Schema.Codec<unknown>, value: unknown): boolean =>
  Result.isSuccess(Result.try(() => Schema.decodeUnknownSync(schema)(value)));

describe('deriveMarkSchema', () => {
  it('models an attribute-less mark by its type literal', () => {
    const Bold = deriveMarkSchema(testSchema.marks.bold);
    expect(decodes(Bold, { type: 'bold' })).toBe(true);
    expect(decodes(Bold, { type: 'italic' })).toBe(false);
  });

  it('requires an attribute with no default', () => {
    const Link = deriveMarkSchema(testSchema.marks.link);
    expect(decodes(Link, { type: 'link', attrs: { href: 'https://x' } })).toBe(true);
    // `title` has a default → optional; `href` has none → required.
    expect(decodes(Link, { type: 'link', attrs: {} })).toBe(false);
  });
});

describe('deriveNodeSchema', () => {
  it('models a text node with its string payload and optional marks', () => {
    const Text = deriveNodeSchema(testSchema.nodes.text);
    expect(decodes(Text, { type: 'text', text: 'hi' })).toBe(true);
    expect(decodes(Text, { type: 'text', text: 'hi', marks: [{ type: 'bold' }] })).toBe(true);
    expect(decodes(Text, { type: 'text' })).toBe(false); // text required
  });

  it("requires a leaf node's non-defaulted attribute but allows omitting the defaulted one", () => {
    const Image = deriveNodeSchema(testSchema.nodes.image);
    expect(decodes(Image, { type: 'image', attrs: { alt: 'a' } })).toBe(true);
    expect(decodes(Image, { type: 'image', attrs: { alt: 'a', src: null } })).toBe(true);
    expect(decodes(Image, { type: 'image', attrs: {} })).toBe(false); // alt required
  });

  it('does not attach marks to a block node (excess key is stripped)', () => {
    const Paragraph = deriveNodeSchema(testSchema.nodes.paragraph);
    // Struct decoding ignores unexpected keys — matching ProseMirror's own
    // `nodeFromJSON`, which reads only declared fields — so a stray `marks`
    // key on a block node is dropped rather than rejected.
    const decoded = Schema.decodeUnknownSync(Paragraph)({
      type: 'paragraph',
      marks: [{ type: 'bold' }],
    });
    expect(decoded).not.toHaveProperty('marks');
  });
});

describe('deriveDocumentSchema', () => {
  const Document = deriveDocumentSchema(testSchema);

  it('validates a nested document', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'hello ' },
            { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
          ],
        },
        { type: 'horizontalRule' },
      ],
    };
    expect(decodes(Document, doc)).toBe(true);
  });

  it('validates the recursive blockquote grammar', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quoted' }] }],
        },
      ],
    };
    expect(decodes(Document, doc)).toBe(true);
  });

  it('rejects an empty required (`block+`) document', () => {
    expect(decodes(Document, { type: 'doc', content: [] })).toBe(false);
  });

  it('rejects an unknown node type', () => {
    const doc = { type: 'doc', content: [{ type: 'aside', content: [] }] };
    expect(decodes(Document, doc)).toBe(false);
  });

  it('renames the top node via topTypeName', () => {
    const Renamed = deriveDocumentSchema(testSchema, { topTypeName: 'blockDocument' });
    const doc = {
      type: 'blockDocument',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    };
    expect(decodes(Renamed, doc)).toBe(true);
    expect(decodes(Renamed, { ...doc, type: 'doc' })).toBe(false);
  });

  it('omits marks entirely when includeMarks is false (they are stripped)', () => {
    const NoMarks = deriveDocumentSchema(testSchema, { includeMarks: false });
    const decoded = Schema.decodeUnknownSync(NoMarks)({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'bold' }] }] },
      ],
    });
    // The text node retains its payload but the marks field is absent.
    const text = decoded.content?.[0]?.content?.[0];
    expect(text).toMatchObject({ type: 'text', text: 'x' });
    expect(text).not.toHaveProperty('marks');
  });

  it('relaxes required content to a possibly-empty array when asked', () => {
    const Lenient = deriveDocumentSchema(testSchema, { nonEmptyRequiredContent: false });
    expect(decodes(Lenient, { type: 'doc', content: [] })).toBe(true);
  });

  it('applies an attribute overlay', () => {
    const Overlaid = deriveDocumentSchema(testSchema, {
      attributes: attributeOverlay({ heading: { level: Schema.Literals([1, 2, 3]) } }),
    });
    const good = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 3 }, content: [] }],
    };
    const bad = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 9 }, content: [] }],
    };
    expect(decodes(Overlaid, good)).toBe(true);
    expect(decodes(Overlaid, bad)).toBe(false);
  });
});

describe('deriveDocumentSchema: a fixed-sequence content expression (`image figcaption`)', () => {
  // Intended behaviour, pinned here: the derivation models a content
  // expression as "an array of a child union", so `image figcaption` derives as
  // a non-empty array drawn from `image | figcaption`. Order and per-type
  // multiplicity are not enforced at the wire. ProseMirror's DOM parser and
  // editing transactions still enforce the sequence; `schema.nodeFromJSON` and
  // ProseKit's `defaultContent` do not check content, so a consumer that wants
  // the check on a loaded document calls `node.check()` (as `setContent` does).
  const Document = deriveDocumentSchema(figureTestSchema);
  const image = { type: 'image', attrs: { src: null } };
  const caption = { type: 'figcaption', content: [{ type: 'text', text: 'A caption' }] };
  const figure = (content: ReadonlyArray<unknown>) => ({
    type: 'doc',
    content: [{ type: 'figure', content }],
  });

  it('accepts the declared sequence', () => {
    expect(decodes(Document, figure([image, caption]))).toBe(true);
  });

  it('accepts a figure without a figcaption', () => {
    expect(decodes(Document, figure([image]))).toBe(true);
  });

  it('accepts a figure holding only a figcaption', () => {
    expect(decodes(Document, figure([caption]))).toBe(true);
  });

  it('accepts the two halves in reverse order', () => {
    expect(decodes(Document, figure([caption, image]))).toBe(true);
  });

  it('accepts a duplicated half', () => {
    expect(decodes(Document, figure([image, image, caption]))).toBe(true);
  });

  it('still rejects an empty figure, a missing content key and a foreign child', () => {
    expect(decodes(Document, figure([]))).toBe(false);
    expect(decodes(Document, { type: 'doc', content: [{ type: 'figure' }] })).toBe(false);
    expect(
      decodes(
        Document,
        figure([image, { type: 'paragraph', content: [{ type: 'text', text: 'x' }] }]),
      ),
    ).toBe(false);
  });
});

describe('deriveDocumentSchemas', () => {
  const { block, inline } = deriveDocumentSchemas({
    block: { schema: testSchema, topTypeName: 'blockDocument' },
    inline: { schema: inlineTestSchema, topTypeName: 'inlineDocument' },
  });

  it('derives independent document schemas, each validating its own document type', () => {
    const blockDoc = {
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hi', marks: [{ type: 'bold' }] }],
        },
      ],
    };
    expect(decodes(block, blockDoc)).toBe(true);
    // The inline schema has no `paragraph` node and a different envelope name.
    expect(decodes(inline, blockDoc)).toBe(false);

    const inlineDoc = { type: 'inlineDocument', content: [{ type: 'text', text: 'hi' }] };
    expect(decodes(inline, inlineDoc)).toBe(true);
    expect(decodes(block, inlineDoc)).toBe(false);
  });

  it('behaves identically to two independent deriveDocumentSchema calls', () => {
    const independentBlock = deriveDocumentSchema(testSchema, { topTypeName: 'blockDocument' });
    const independentInline = deriveDocumentSchema(inlineTestSchema, {
      topTypeName: 'inlineDocument',
    });
    const doc = { type: 'blockDocument', content: [{ type: 'horizontalRule' }] };
    expect(decodes(block, doc)).toBe(decodes(independentBlock, doc));
    const empty = { type: 'inlineDocument', content: [] };
    expect(decodes(inline, empty)).toBe(decodes(independentInline, empty));
  });

  it('applies a shared attribute overlay across every schema in the call', () => {
    const { block: overlaid } = deriveDocumentSchemas(
      { block: { schema: testSchema, topTypeName: 'blockDocument' } },
      { attributes: attributeOverlay({ heading: { level: Schema.Literals([1, 2, 3]) } }) },
    );
    const good = {
      type: 'blockDocument',
      content: [{ type: 'heading', attrs: { level: 3 }, content: [] }],
    };
    const bad = {
      type: 'blockDocument',
      content: [{ type: 'heading', attrs: { level: 9 }, content: [] }],
    };
    expect(decodes(overlaid, good)).toBe(true);
    expect(decodes(overlaid, bad)).toBe(false);
  });

  it("shares a mark's derived schema — by reference — across two Registrys given the same cache", () => {
    // The mechanism `deriveDocumentSchemas` relies on: two `Registry`
    // instances over structurally-identical (but distinct) `bold` mark types,
    // sharing one `RegistryCache`, resolve to the very same `Schema.Codec`
    // object rather than building it twice.
    const cache = createRegistryCache();
    const blockBold = new Registry(testSchema, {}, cache).mark(testSchema.marks.bold);
    const inlineBold = new Registry(inlineTestSchema, {}, cache).mark(inlineTestSchema.marks.bold);
    expect(inlineBold).toBe(blockBold);

    // Without a shared cache, each Registry builds its own (structurally
    // equal, but distinct) mark schema.
    const isolatedBlockBold = new Registry(testSchema).mark(testSchema.marks.bold);
    const isolatedInlineBold = new Registry(inlineTestSchema).mark(inlineTestSchema.marks.bold);
    expect(isolatedInlineBold).not.toBe(isolatedBlockBold);
  });
});
