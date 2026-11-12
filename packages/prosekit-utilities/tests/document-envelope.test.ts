/**
 * Unit tests for `defineDocumentEnvelope`.
 *
 * Two properties carry the envelope/grammar split:
 *
 * 1. **Uninstalled, the check is structural and PERMISSIVE.** A browser
 *    bundle validates the top-level `type` and that `content` is an array of
 *    JSON, and nothing more — it must never reject a document the compiled
 *    ProseMirror schema would accept, because that would break authoring on
 *    the client while the server (which decides) was perfectly happy. The
 *    check is deliberately shallow rather than a full node walk: see
 *    `ContentEnvelope`'s doc for the measurement behind that.
 * 2. **Installed, the check is the full grammar.** A server runtime installs
 *    the guard derived from the compiled ProseMirror schema, so the API edge
 *    rejects exactly what that schema rejects — SEC-XSS-001 unchanged.
 *
 * The blocks below are order-dependent within a envelope: an install is global
 * to that envelope for the life of the isolate (that is the point — it is a
 * per-isolate upgrade, not a per-call option), so the uninstalled
 * expectations run against their own envelope.
 *
 * The guard installed here is a hand-written stand-in for the ProseKit-
 * derived one: the root entry cannot import ProseKit, and what these tests
 * pin is that an installed guard is consulted at validation time, not what
 * any particular grammar admits.
 *
 * @module
 */

import * as DateTime from 'effect/DateTime';
import * as Schema from 'effect/Schema';
import { describe, expect, it } from 'vite-plus/test';
import { defineAllowList } from '../src/allow-list.ts';
import { defineDocumentEnvelope } from '../src/document-envelope.ts';
import type { NodeJSON } from '../src/json.ts';

// ── A stand-in grammar guard ──────────────────────────────────────────

/** One node as the stand-in grammar sees it: a `type`, and maybe children. */
type StandInNode = { readonly type: string } & Partial<{
  readonly content: ReadonlyArray<StandInNode>;
}>;

/** Every node has a known `type`, recursively. */
const knownNodes = (known: ReadonlyArray<string>): Schema.Codec<StandInNode> => {
  const Node: Schema.Codec<StandInNode> = Schema.Struct({
    type: Schema.Literals(known),
    content: Schema.optionalKey(Schema.Array(Schema.suspend(() => Node))),
  });
  return Node;
};

const BlockNode = knownNodes([
  'paragraph',
  'heading',
  'text',
  'hardBreak',
  'image',
  'list',
  'blockquote',
]);
const InlineNode = knownNodes(['text', 'hardBreak']);

/** Mimics a derived block-document guard: `block+`, known node types only. */
const isBlockDocument = Schema.is(
  Schema.Struct({
    type: Schema.Literal('blockDocument'),
    content: Schema.NonEmptyArray(BlockNode),
  }),
);

/** Mimics a derived inline-document guard: `inline*`, inline node types only. */
const isInlineDocument = Schema.is(
  Schema.Struct({ type: Schema.Literal('inlineDocument'), content: Schema.Array(InlineNode) }),
);

// ── Fixtures ──────────────────────────────────────────────────────────

/** A document that is valid under the stand-in grammar. */
const validBlock = {
  type: 'blockDocument',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'hello', marks: [{ type: 'bold' }] }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'a heading' }] },
  ],
};

/** Structurally well-formed, but no grammar admits it: a block document is `block+`. */
const grammarInvalidBlock = { type: 'blockDocument', content: [] };

/** Structurally well-formed, but `nonsenseNode` is not in the node registry. */
const unknownNodeBlock = {
  type: 'blockDocument',
  content: [{ type: 'nonsenseNode', content: [{ type: 'text', text: 'x' }] }],
};

// ── Declaration ───────────────────────────────────────────────────────

describe('defineDocumentEnvelope: declaration', () => {
  it('keeps the name and derives a label from it', () => {
    const envelope = defineDocumentEnvelope({ name: 'blockDocument' });
    expect(envelope.name).toBe('blockDocument');
    expect(envelope.label).toBe('block document');
  });

  it('splits every camel-case boundary in the derived label', () => {
    expect(defineDocumentEnvelope({ name: 'articleSectionBody' }).label).toBe(
      'article section body',
    );
    expect(defineDocumentEnvelope({ name: 'note' }).label).toBe('note');
  });

  it('prefers an explicit label', () => {
    const envelope = defineDocumentEnvelope({ name: 'blockDocument', label: 'a post body' });
    expect(envelope.label).toBe('a post body');
    expect(() => Schema.decodeUnknownSync(envelope.Schema)({ type: 'nope' })).toThrow(
      'Expected "blockDocument"',
    );
  });

  it('empty() is a valid document of the envelope', () => {
    const envelope = defineDocumentEnvelope({ name: 'inlineDocument' });
    expect(envelope.empty()).toEqual({ type: 'inlineDocument', content: [] });
    expect(Schema.decodeSync(envelope.Schema)(envelope.empty())).toEqual(envelope.empty());
  });

  it('gives each envelope its own guard slot', () => {
    const one = defineDocumentEnvelope({ name: 'blockDocument' });
    const two = defineDocumentEnvelope({ name: 'blockDocument' });
    one.install(isBlockDocument);
    expect(one.isInstalled()).toBe(true);
    expect(two.isInstalled()).toBe(false);
  });
});

// ── Uninstalled ───────────────────────────────────────────────────────

describe('DocumentEnvelope.Schema: structural check, grammar not installed', () => {
  const block = defineDocumentEnvelope({ name: 'blockDocument' });
  const inline = defineDocumentEnvelope({ name: 'inlineDocument' });
  const decodeBlock = Schema.decodeUnknownSync(block.Schema);
  const decodeInline = Schema.decodeUnknownSync(inline.Schema);

  it('starts out uninstalled', () => {
    expect(block.isInstalled()).toBe(false);
    expect(inline.isInstalled()).toBe(false);
  });

  it('accepts a grammar-valid document unchanged', () => {
    expect(decodeBlock(validBlock)).toEqual(validBlock);
  });

  it('accepts a grammar-valid inline document unchanged', () => {
    const doc = { type: 'inlineDocument', content: [{ type: 'text', text: 'a title' }] };
    expect(decodeInline(doc)).toEqual(doc);
  });

  it('rejects a non-object, a null, and a wrong top-level type', () => {
    expect(() => decodeBlock(null)).toThrow('Expected blockDocumentGrammar');
    expect(() => decodeBlock('blockDocument')).toThrow('Expected blockDocumentGrammar');
    expect(() => decodeBlock({ type: 'inlineDocument', content: [] })).toThrow(
      'Expected "blockDocument"',
    );
    expect(() => decodeInline({ type: 'blockDocument', content: [] })).toThrow(
      'Expected "inlineDocument"',
    );
  });

  it('rejects a missing `content`, and a `content` that is not an array', () => {
    expect(() => decodeBlock({ type: 'blockDocument' })).toThrow('Missing key');
    expect(() => decodeBlock({ type: 'blockDocument', content: 'nope' })).toThrow('Expected array');
  });

  it('rejects a non-JSON value inside `content` (the wire-safety half of the check)', () => {
    expect(() =>
      decodeBlock({ type: 'blockDocument', content: [DateTime.toDateUtc(DateTime.makeUnsafe(0))] }),
    ).toThrow('Expected JSON value');
    expect(() => decodeBlock({ type: 'blockDocument', content: [() => 'x'] })).toThrow(
      'Expected JSON value',
    );
  });

  it('does NOT check per-node structure — that is the grammar guard s job, not this one', () => {
    const nodeWithoutType = { type: 'blockDocument', content: [{ attrs: {} }] };
    expect(isBlockDocument(nodeWithoutType)).toBe(false);
    expect(decodeBlock(nodeWithoutType)).toEqual(nodeWithoutType);
  });

  it('is PERMISSIVE about grammar — the documents a derived schema rejects still pass', () => {
    expect(isBlockDocument(grammarInvalidBlock)).toBe(false);
    expect(isBlockDocument(unknownNodeBlock)).toBe(false);
    expect(decodeBlock(grammarInvalidBlock)).toEqual(grammarInvalidBlock);
    expect(decodeBlock(unknownNodeBlock)).toEqual(unknownNodeBlock);
  });

  it('is() agrees with the schema', () => {
    expect(block.is(validBlock)).toBe(true);
    expect(block.is(unknownNodeBlock)).toBe(true);
    expect(block.is({ type: 'inlineDocument', content: [] })).toBe(false);
  });
});

// ── Installed ─────────────────────────────────────────────────────────

describe('DocumentEnvelope.Schema: grammar installed', () => {
  const block = defineDocumentEnvelope({ name: 'blockDocument' });
  const inline = defineDocumentEnvelope({ name: 'inlineDocument' });
  block.install(isBlockDocument);
  inline.install(isInlineDocument);
  const decodeBlock = Schema.decodeUnknownSync(block.Schema);
  const decodeInline = Schema.decodeUnknownSync(inline.Schema);

  it('reports itself installed', () => {
    expect(block.isInstalled()).toBe(true);
    expect(inline.isInstalled()).toBe(true);
  });

  it('still accepts a grammar-valid document', () => {
    expect(decodeBlock(validBlock)).toEqual(validBlock);
  });

  it('now rejects the documents the derived schema rejects', () => {
    expect(() => decodeBlock(grammarInvalidBlock)).toThrow('must be a valid block document');
    expect(() => decodeBlock(unknownNodeBlock)).toThrow('must be a valid block document');
  });

  it('now rejects the per-node structure errors the structural check waves through', () => {
    expect(() => decodeBlock({ type: 'blockDocument', content: [{ attrs: {} }] })).toThrow(
      'must be a valid block document',
    );
    expect(() =>
      decodeBlock({
        type: 'blockDocument',
        content: [{ type: 'paragraph', content: [{ text: 'no type here' }] }],
      }),
    ).toThrow('must be a valid block document');
  });

  it('names the envelope in the failure message', () => {
    expect(() => decodeBlock(grammarInvalidBlock)).toThrow(/block document/);
  });

  it('applies on encode as well as decode — the write path is a boundary too', () => {
    const encode = Schema.encodeUnknownSync(block.Schema);
    expect(() => encode(unknownNodeBlock)).toThrow('must be a valid block document');
  });

  it('checks the inline document against the inline grammar', () => {
    const inlineWithBlockNode = {
      type: 'inlineDocument',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    };
    expect(isInlineDocument(inlineWithBlockNode)).toBe(false);
    expect(() => decodeInline(inlineWithBlockNode)).toThrow('must be a valid inline document');
  });

  it('reads the guard at validation time, not at construction time', () => {
    // The schema is built before any install; a document that was accepted
    // uninstalled stops being accepted the moment the guard lands.
    const late = defineDocumentEnvelope({ name: 'blockDocument' });
    const decode = Schema.decodeUnknownSync(late.Schema);
    expect(decode(unknownNodeBlock)).toEqual(unknownNodeBlock);
    late.install(isBlockDocument);
    expect(() => decode(unknownNodeBlock)).toThrow('must be a valid block document');
  });

  it('is() degrades a guard that throws to false rather than propagating the defect', () => {
    const exploding = defineDocumentEnvelope({ name: 'blockDocument' });
    exploding.install(() => {
      throw new RangeError('Maximum call stack size exceeded');
    });
    expect(exploding.is(validBlock)).toBe(false);
  });
});

// ── narrow ────────────────────────────────────────────────────────────

describe('DocumentEnvelope.narrow', () => {
  const envelope = defineDocumentEnvelope({ name: 'blockDocument' });
  const comment = defineAllowList({
    label: 'a comment',
    nodes: ['paragraph', 'text', 'hardBreak'],
    marks: ['bold', 'italic', 'strike', 'code', 'link'],
  });
  const decodeNarrow = Schema.decodeUnknownSync(envelope.narrow(comment));

  const paragraph = (...content: ReadonlyArray<NodeJSON>) => ({
    type: 'blockDocument',
    content: [{ type: 'paragraph', content }],
  });

  it('accepts a document inside the allow-list', () => {
    const doc = paragraph({ type: 'text', text: 'hello' });
    expect(decodeNarrow(doc)).toEqual(doc);
  });

  it('rejects a node outside the allow-list, with the violation s own message', () => {
    expect(() => decodeNarrow({ type: 'blockDocument', content: [{ type: 'heading' }] })).toThrow(
      /node type "heading" is not permitted in a comment/,
    );
  });

  it('rejects an unsafe link href', () => {
    expect(() =>
      decodeNarrow(
        paragraph({
          type: 'text',
          text: 'x',
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        }),
      ),
    ).toThrow(/URL scheme/);
  });

  it('still applies the structural check', () => {
    expect(() => decodeNarrow({ type: 'inlineDocument', content: [] })).toThrow(
      'Expected "blockDocument"',
    );
  });

  it('leaves the envelope s own schema unnarrowed', () => {
    const doc = { type: 'blockDocument', content: [{ type: 'heading' }] };
    expect(Schema.decodeUnknownSync(envelope.Schema)(doc)).toEqual(doc);
  });
});
