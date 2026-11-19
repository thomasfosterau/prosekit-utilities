/**
 * Two document schemas sharing one `RegistryCache` stay independently lazy:
 * deriving one never compiles the other.
 */

import { describe, expect, it } from 'vite-plus/test';
import * as MutableHashMap from 'effect/MutableHashMap';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { defineDocumentEnvelope } from '../../src/document-envelope.ts';
import { defineDocumentSchema } from '../../src/prosekit/document-schema.ts';
import { defineBlockDocumentExtension } from '../../src/prosekit/presets.ts';
import { createDocumentFixture, createSharedCacheFixture } from './fixture.ts';

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
  const { block, inline, blockCache: cache } = createSharedCacheFixture();

  it('nothing is derived until a document is validated', () => {
    expect(MutableHashMap.size(cache.nodeCache)).toBe(0);
    expect(MutableHashMap.size(cache.markCache)).toBe(0);
  });

  it('decodes the inline document correctly when forced first', () => {
    expect(Schema.decodeUnknownSync(inline.Document)(INLINE_DOC)).toEqual(INLINE_DOC);
    // The shared structure is now in the cache.
    expect(MutableHashMap.has(cache.markCache, 'bold')).toBe(true);
    expect(MutableHashMap.has(cache.nodeCache, 'text')).toBe(true);
  });

  it('decodes the block document correctly afterwards, sharing the mark/text derivation', () => {
    const marks = Option.getOrUndefined(MutableHashMap.get(cache.markCache, 'bold'));
    const text = Option.getOrUndefined(MutableHashMap.get(cache.nodeCache, 'text'));
    expect(marks).toBeDefined();
    expect(text).toBeDefined();
    expect(Schema.decodeUnknownSync(block.Document)(BLOCK_DOC)).toEqual(BLOCK_DOC);
    // Reused, not rebuilt.
    expect(Option.getOrUndefined(MutableHashMap.get(cache.markCache, 'bold'))).toBe(marks);
    expect(Option.getOrUndefined(MutableHashMap.get(cache.nodeCache, 'text'))).toBe(text);
  });
});

describe('shared registry cache: block forced first', () => {
  const { block, inline } = createSharedCacheFixture();

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
      Schema.decodeSync(inline.Document)({
        type: 'inlineDocument',
        content: [{ type: 'paragraph', content: [] }],
      }),
    ).toThrow('Expected "text"');
  });
});

const citedText = {
  type: 'text',
  text: 'cited',
  marks: [{ type: 'citation', attrs: { workId: 'w-1' } }],
};
const INLINE_CITED = { type: 'inlineDocument', content: [citedText] };
const BLOCK_CITED = {
  type: 'blockDocument',
  content: [{ type: 'paragraph', content: [citedText] }],
};

describe('an opt-in mark in one grammar only (`citation`, block grammar)', () => {
  it('the two grammars derive against separate caches', () => {
    const { blockCache, inlineCache } = createDocumentFixture();
    expect(blockCache).not.toBe(inlineCache);
  });

  it('inline forced first: inline rejects `citation`, then block accepts it', () => {
    const { block, inline } = createDocumentFixture();
    expect(inline.is(INLINE_CITED)).toBe(false);
    expect(block.is(BLOCK_CITED)).toBe(true);
  });

  it('block forced first: block accepts `citation`, then inline rejects it', () => {
    const { block, inline } = createDocumentFixture();
    expect(block.is(BLOCK_CITED)).toBe(true);
    expect(inline.is(INLINE_CITED)).toBe(false);
  });

  it('each grammar alone: inline rejects `citation`, block accepts it', () => {
    expect(createDocumentFixture().inline.is(INLINE_CITED)).toBe(false);
    expect(createDocumentFixture().block.is(BLOCK_CITED)).toBe(true);
  });
});

describe('no caller-supplied cache', () => {
  it('derives against a cache private to the schema', () => {
    const envelope = defineDocumentEnvelope({ name: 'blockDocument' });
    const schema = defineDocumentSchema(envelope, {
      extension: () => defineBlockDocumentExtension(),
    });
    expect(Schema.decodeUnknownSync(schema.Document)(BLOCK_DOC)).toEqual(BLOCK_DOC);
    // A second decode reuses the same private cache rather than rebuilding.
    expect(Schema.decodeUnknownSync(schema.Document)(BLOCK_DOC)).toEqual(BLOCK_DOC);
  });
});
