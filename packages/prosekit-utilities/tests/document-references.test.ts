/**
 * Unit tests for reference extraction.
 *
 * `extractMentions` / `extractCitations` feed an index kept in step with a
 * stored document at write time, so what matters is document order, one
 * entry per distinct id, and the same tolerance `extractDocumentText` has:
 * a malformed row degrades to no references rather than failing a batch.
 *
 * @module
 */

import type * as Schema from 'effect/Schema';
import { describe, expect, it } from 'vite-plus/test';
import { extractCitations, extractMentions } from '../src/document-references.ts';
import type { DocumentJSON, NodeJSON } from '../src/json.ts';

/** A stored-row value the envelope type rules out, typed as a document on purpose. */
const malformed = (value: Schema.Json | DocumentJSON): DocumentJSON =>
  // SAFETY: deliberately ill-typed input is the point of every caller.
  value as DocumentJSON;

const mention = (id: string, label: string): NodeJSON => ({
  type: 'mention',
  attrs: { id, label },
});

const cited = (text: string, workId: string): NodeJSON => ({
  type: 'text',
  text,
  marks: [{ type: 'bold' }, { type: 'citation', attrs: { workId } }],
});

const doc: DocumentJSON = {
  type: 'blockDocument',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'With ' },
        mention('u2', 'Bea'),
        { type: 'text', text: ' and ' },
        mention('u1', 'Ada'),
        cited('Origins', 'w9'),
      ],
    },
    {
      type: 'list',
      attrs: { kind: 'bullet' },
      content: [
        {
          type: 'paragraph',
          content: [
            mention('u2', 'Beatrice'),
            cited('Flora', 'w3'),
            {
              type: 'sidenote',
              content: [cited('again', 'w9'), mention('u3', 'Cy')],
            },
          ],
        },
      ],
    },
  ],
};

describe('extractMentions', () => {
  it('lists each mentioned id once, in first-mention order, at any depth', () => {
    expect(extractMentions(doc)).toEqual([
      { id: 'u2', label: 'Bea' },
      { id: 'u1', label: 'Ada' },
      { id: 'u3', label: 'Cy' },
    ]);
  });

  it('returns nothing for no content and empty content', () => {
    expect(extractMentions(malformed({ type: 'blockDocument' }))).toEqual([]);
    expect(extractMentions({ type: 'blockDocument', content: [] })).toEqual([]);
  });

  it('skips an unresolved mention (empty id) and one whose id is not a string', () => {
    const value = malformed({
      type: 'inlineDocument',
      content: [
        { type: 'mention', attrs: { id: '', label: 'nobody' } },
        { type: 'mention', attrs: { id: 7, label: 'seven' } },
        { type: 'mention' },
        { type: 'mention', attrs: null },
        { type: 'mention', attrs: { id: 'u1', label: 'Ada' } },
      ],
    });
    expect(extractMentions(value)).toEqual([{ id: 'u1', label: 'Ada' }]);
  });

  it('keeps a mention whose label is missing or not a string, with an empty label', () => {
    const value = malformed({
      type: 'inlineDocument',
      content: [
        { type: 'mention', attrs: { id: 'u1' } },
        { type: 'mention', attrs: { id: 'u2', label: 3 } },
      ],
    });
    expect(extractMentions(value)).toEqual([
      { id: 'u1', label: '' },
      { id: 'u2', label: '' },
    ]);
  });

  it('ignores stray non-object entries and a non-array content', () => {
    const value = malformed({
      type: 'blockDocument',
      content: [
        null,
        'text',
        3,
        { type: 'paragraph', content: 'oops' },
        { type: 'mention', attrs: { id: 'u1', label: 'Ada' } },
      ],
    });
    expect(extractMentions(value)).toEqual([{ id: 'u1', label: 'Ada' }]);
  });

  it('reads a bare node as well as an envelope', () => {
    expect(extractMentions({ type: 'paragraph', content: [mention('u1', 'Ada')] })).toEqual([
      { id: 'u1', label: 'Ada' },
    ]);
  });
});

describe('extractCitations', () => {
  it('lists each cited work id once, in first-citation order, at any depth', () => {
    expect(extractCitations(doc)).toEqual(['w9', 'w3']);
  });

  it('returns nothing for no content and empty content', () => {
    expect(extractCitations(malformed({ type: 'blockDocument' }))).toEqual([]);
    expect(extractCitations({ type: 'blockDocument', content: [] })).toEqual([]);
  });

  it('skips an empty or non-string workId, a malformed mark and non-array marks', () => {
    const value = malformed({
      type: 'inlineDocument',
      content: [
        { type: 'text', text: 'a', marks: [{ type: 'citation', attrs: { workId: '' } }] },
        { type: 'text', text: 'b', marks: [{ type: 'citation', attrs: { workId: 4 } }] },
        { type: 'text', text: 'c', marks: [{ type: 'citation' }, null, 'citation'] },
        { type: 'text', text: 'd', marks: 'citation' },
        { type: 'text', text: 'e', marks: [{ type: 'citation', attrs: { workId: 'w1' } }] },
      ],
    });
    expect(extractCitations(value)).toEqual(['w1']);
  });

  it('ignores marks other than citation, even when they carry a workId', () => {
    const value = malformed({
      type: 'inlineDocument',
      content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { workId: 'w1' } }] }],
    });
    expect(extractCitations(value)).toEqual([]);
  });
});
