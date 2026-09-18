/**
 * Unit tests for `defineDocumentShape`.
 *
 * Two properties carry the shape/grammar split:
 *
 * 1. **Uninstalled, the check is structural and PERMISSIVE.** A browser
 *    bundle validates the top-level `type` and that `content` is an array of
 *    JSON, and nothing more — it must never reject a document the compiled
 *    ProseMirror schema would accept, because that would break authoring on
 *    the client while the server (which decides) was perfectly happy. The
 *    check is deliberately shallow rather than a full node walk: see
 *    `ContentShape`'s doc for the measurement behind that.
 * 2. **Installed, the check is the full grammar.** A server runtime installs
 *    the guard derived from the compiled ProseMirror schema, so the API edge
 *    rejects exactly what that schema rejects — SEC-XSS-001 unchanged.
 *
 * The blocks below are order-dependent within a shape: an install is global
 * to that shape for the life of the isolate (that is the point — it is a
 * per-isolate upgrade, not a per-call option), so the uninstalled
 * expectations run against their own shape.
 *
 * The guard installed here is a hand-written stand-in for the ProseKit-
 * derived one: the root entry cannot import ProseKit, and what these tests
 * pin is that an installed guard is consulted at validation time, not what
 * any particular grammar admits.
 *
 * @module
 */

import * as Schema from 'effect/Schema';
import { describe, expect, it } from 'vite-plus/test';
import { defineAllowList } from '../src/allow-list.ts';
import { defineDocumentShape } from '../src/document-shape.ts';
import type { NodeJSON } from '../src/json.ts';

// ── A stand-in grammar guard ──────────────────────────────────────────

const BLOCK_NODES = new Set([
  'paragraph',
  'heading',
  'text',
  'hardBreak',
  'image',
  'list',
  'blockquote',
]);
const INLINE_NODES = new Set(['text', 'hardBreak']);

/** Every node has a known `type`, recursively. */
const nodesValid = (nodes: unknown, known: ReadonlySet<string>): boolean =>
  Array.isArray(nodes) &&
  nodes.every((node) => {
    if (typeof node !== 'object' || node === null) return false;
    const record = node as Record<string, unknown>;
    if (typeof record.type !== 'string' || !known.has(record.type)) return false;
    return record.content === undefined || nodesValid(record.content, known);
  });

/** Mimics a derived block-document guard: `block+`, known node types only. */
const isBlockDocument = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.type !== 'blockDocument') return false;
  return (
    Array.isArray(record.content) &&
    record.content.length > 0 &&
    nodesValid(record.content, BLOCK_NODES)
  );
};

/** Mimics a derived inline-document guard: `inline*`, inline node types only. */
const isInlineDocument = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.type !== 'inlineDocument') return false;
  return nodesValid(record.content, INLINE_NODES);
};

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

describe('defineDocumentShape: declaration', () => {
  it('keeps the name and derives a label from it', () => {
    const shape = defineDocumentShape({ name: 'blockDocument' });
    expect(shape.name).toBe('blockDocument');
    expect(shape.label).toBe('block document');
  });

  it('splits every camel-case boundary in the derived label', () => {
    expect(defineDocumentShape({ name: 'articleSectionBody' }).label).toBe('article section body');
    expect(defineDocumentShape({ name: 'note' }).label).toBe('note');
  });

  it('prefers an explicit label', () => {
    const shape = defineDocumentShape({ name: 'blockDocument', label: 'a post body' });
    expect(shape.label).toBe('a post body');
    expect(() => Schema.decodeUnknownSync(shape.Schema)({ type: 'nope' })).toThrow();
  });

  it('empty() is a valid document of the shape', () => {
    const shape = defineDocumentShape({ name: 'inlineDocument' });
    expect(shape.empty()).toEqual({ type: 'inlineDocument', content: [] });
    expect(Schema.decodeUnknownSync(shape.Schema)(shape.empty())).toEqual(shape.empty());
  });

  it('gives each shape its own guard slot', () => {
    const one = defineDocumentShape({ name: 'blockDocument' });
    const two = defineDocumentShape({ name: 'blockDocument' });
    one.install(isBlockDocument);
    expect(one.isInstalled()).toBe(true);
    expect(two.isInstalled()).toBe(false);
  });
});

// ── Uninstalled ───────────────────────────────────────────────────────

describe('DocumentShape.Schema: structural check, grammar not installed', () => {
  const block = defineDocumentShape({ name: 'blockDocument' });
  const inline = defineDocumentShape({ name: 'inlineDocument' });
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
    expect(() => decodeBlock(null)).toThrow();
    expect(() => decodeBlock('blockDocument')).toThrow();
    expect(() => decodeBlock({ type: 'inlineDocument', content: [] })).toThrow();
    expect(() => decodeInline({ type: 'blockDocument', content: [] })).toThrow();
  });

  it('rejects a missing `content`, and a `content` that is not an array', () => {
    expect(() => decodeBlock({ type: 'blockDocument' })).toThrow();
    expect(() => decodeBlock({ type: 'blockDocument', content: 'nope' })).toThrow();
  });

  it('rejects a non-JSON value inside `content` (the wire-safety half of the check)', () => {
    expect(() => decodeBlock({ type: 'blockDocument', content: [new Date()] })).toThrow();
    expect(() => decodeBlock({ type: 'blockDocument', content: [() => 'x'] })).toThrow();
  });

  it('does NOT check per-node shape — that is the grammar guard s job, not this one', () => {
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

describe('DocumentShape.Schema: grammar installed', () => {
  const block = defineDocumentShape({ name: 'blockDocument' });
  const inline = defineDocumentShape({ name: 'inlineDocument' });
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
    expect(() => decodeBlock(grammarInvalidBlock)).toThrow();
    expect(() => decodeBlock(unknownNodeBlock)).toThrow();
  });

  it('now rejects the per-node shape errors the structural check waves through', () => {
    expect(() => decodeBlock({ type: 'blockDocument', content: [{ attrs: {} }] })).toThrow();
    expect(() =>
      decodeBlock({
        type: 'blockDocument',
        content: [{ type: 'paragraph', content: [{ text: 'no type here' }] }],
      }),
    ).toThrow();
  });

  it('names the shape in the failure message', () => {
    expect(() => decodeBlock(grammarInvalidBlock)).toThrow(/block document/);
  });

  it('applies on encode as well as decode — the write path is a boundary too', () => {
    const encode = Schema.encodeUnknownSync(block.Schema);
    expect(() => encode(unknownNodeBlock)).toThrow();
  });

  it('checks the inline document against the inline grammar', () => {
    const inlineWithBlockNode = {
      type: 'inlineDocument',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    };
    expect(isInlineDocument(inlineWithBlockNode)).toBe(false);
    expect(() => decodeInline(inlineWithBlockNode)).toThrow();
  });

  it('reads the guard at validation time, not at construction time', () => {
    // The schema is built before any install; a document that was accepted
    // uninstalled stops being accepted the moment the guard lands.
    const late = defineDocumentShape({ name: 'blockDocument' });
    const decode = Schema.decodeUnknownSync(late.Schema);
    expect(decode(unknownNodeBlock)).toEqual(unknownNodeBlock);
    late.install(isBlockDocument);
    expect(() => decode(unknownNodeBlock)).toThrow();
  });

  it('is() degrades a guard that throws to false rather than propagating the defect', () => {
    const exploding = defineDocumentShape({ name: 'blockDocument' });
    exploding.install(() => {
      throw new RangeError('Maximum call stack size exceeded');
    });
    expect(exploding.is(validBlock)).toBe(false);
  });
});

// ── narrow ────────────────────────────────────────────────────────────

describe('DocumentShape.narrow', () => {
  const shape = defineDocumentShape({ name: 'blockDocument' });
  const comment = defineAllowList({
    label: 'a comment',
    nodes: ['paragraph', 'text', 'hardBreak'],
    marks: ['bold', 'italic', 'strike', 'code', 'link'],
  });
  const decodeNarrow = Schema.decodeUnknownSync(shape.narrow(comment));

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
    expect(() => decodeNarrow({ type: 'inlineDocument', content: [] })).toThrow();
  });

  it('leaves the shape s own schema unnarrowed', () => {
    const doc = { type: 'blockDocument', content: [{ type: 'heading' }] };
    expect(Schema.decodeUnknownSync(shape.Schema)(doc)).toEqual(doc);
  });
});
