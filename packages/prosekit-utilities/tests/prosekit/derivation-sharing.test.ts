/**
 * Two document schemas sharing one `RegistryCache` stay **independently lazy**.
 *
 * A block grammar and an inline grammar both compose `defineStandardMarks()`
 * and `defineText()`, so they derive the same mark schemas and the same `text`
 * node schema; passing both the same cache means whichever is forced first
 * builds that structure and the other reuses it. What must NOT follow is a
 * dependency: forcing one must not throw, skip or otherwise require the other
 * to have been forced first.
 *
 * Order is the whole point, so both orderings are exercised — each `describe`
 * builds its own pair and forces them the opposite way round, which is the
 * property a single shared module-scope cache could silently break.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import * as Schema from 'effect/Schema';
import { defineDocumentShape } from '../../src/document-shape.ts';
import { defineDocumentSchema } from '../../src/prosekit/document-schema.ts';
import { defineBlockDocumentExtension } from '../../src/prosekit/presets.ts';
import { createDocumentFixture } from './fixture.ts';

const BLOCK_DOC = {
  type: 'blockDocument',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }] },
  ],
};

const INLINE_DOC = {
  type: 'inlineDocument',
  content: [{ type: 'text', text: 'hi', marks: [{ type: 'bold' }] }],
};

describe('shared registry cache: inline forced first', () => {
  const { block, inline, cache } = createDocumentFixture();

  it('nothing is derived until a document is validated', () => {
    expect(cache.nodeCache.size).toBe(0);
    expect(cache.markCache.size).toBe(0);
  });

  it('decodes the inline document correctly when forced first', () => {
    expect(Schema.decodeUnknownSync(inline.Document)(INLINE_DOC)).toEqual(INLINE_DOC);
    // The shared structure is now in the cache.
    expect(cache.markCache.has('bold')).toBe(true);
    expect(cache.nodeCache.has('text')).toBe(true);
  });

  it('decodes the block document correctly afterwards, sharing the mark/text derivation', () => {
    const marks = cache.markCache.get('bold');
    const text = cache.nodeCache.get('text');
    expect(Schema.decodeUnknownSync(block.Document)(BLOCK_DOC)).toEqual(BLOCK_DOC);
    // Reused, not rebuilt.
    expect(cache.markCache.get('bold')).toBe(marks);
    expect(cache.nodeCache.get('text')).toBe(text);
  });
});

describe('shared registry cache: block forced first', () => {
  const { block, inline } = createDocumentFixture();

  it('decodes the block document correctly when forced first', () => {
    expect(Schema.decodeUnknownSync(block.Document)(BLOCK_DOC)).toEqual(BLOCK_DOC);
  });

  it('decodes the inline document correctly afterwards', () => {
    expect(Schema.decodeUnknownSync(inline.Document)(INLINE_DOC)).toEqual(INLINE_DOC);
  });

  it('does not let the block grammar leak into the inline one through the shared cache', () => {
    // Memoisation is by name, and the two grammars register the same-named
    // types identically — so sharing is safe, but it must not widen what the
    // inline document admits.
    expect(() =>
      Schema.decodeUnknownSync(inline.Document)({
        type: 'inlineDocument',
        content: [{ type: 'paragraph', content: [] }],
      }),
    ).toThrow();
  });
});

describe('no caller-supplied cache', () => {
  it('derives against a cache private to the schema', () => {
    const shape = defineDocumentShape({ name: 'blockDocument' });
    const schema = defineDocumentSchema(shape, {
      extension: () => defineBlockDocumentExtension(),
    });
    expect(Schema.decodeUnknownSync(schema.Document)(BLOCK_DOC)).toEqual(BLOCK_DOC);
    // A second decode reuses the same private cache rather than rebuilding.
    expect(Schema.decodeUnknownSync(schema.Document)(BLOCK_DOC)).toEqual(BLOCK_DOC);
  });
});
