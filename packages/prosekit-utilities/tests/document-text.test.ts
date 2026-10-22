/**
 * Unit tests for plain-text extraction.
 *
 * `extractDocumentText` is the seam an embedding queue or a search index
 * uses to turn a stored document into text, so the recursive walk and the
 * empty / malformed guards are what matter: a malformed row has to degrade
 * to empty text rather than fail a batch. `inlineDocumentText` is the
 * title-shaped twin — the `''` join, because a title must not gain spaces
 * its author never typed.
 *
 * @module
 */

import type * as Schema from 'effect/Schema';
import { describe, expect, it } from 'vite-plus/test';
import { extractDocumentText, inlineDocumentText } from '../src/document-text.ts';
import type { DocumentJSON } from '../src/json.ts';

/**
 * A stored-row value the envelope type rules out — no content array, a
 * non-string `text`, `null` entries — typed as a document on purpose, so a
 * case can pin how tolerant the walk is of what a jsonb column can hold.
 */
const malformed = (value: Schema.Json): DocumentJSON =>
  // SAFETY: deliberately ill-typed input is the point of every caller.
  value as DocumentJSON;

describe('extractDocumentText', () => {
  it('returns the empty string for null / undefined', () => {
    expect(extractDocumentText(null)).toBe('');
    expect(extractDocumentText(undefined)).toBe('');
  });

  it('returns the empty string for a document with no content array', () => {
    expect(extractDocumentText(malformed({ type: 'blockDocument' }))).toBe('');
  });

  it('returns the empty string for an empty content array', () => {
    expect(extractDocumentText({ type: 'blockDocument', content: [] })).toBe('');
  });

  it('concatenates top-level inline text nodes separated by a space', () => {
    const doc: DocumentJSON = {
      type: 'inlineDocument',
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'world' },
      ],
    };
    expect(extractDocumentText(doc)).toBe('Hello world');
  });

  it('recurses into nested block content and gathers every text leaf in order', () => {
    const doc: DocumentJSON = {
      type: 'blockDocument',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Plain and' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    expect(extractDocumentText(doc)).toBe('Title Plain and bold');
  });

  it('ignores non-text leaves and nodes without a string `text`', () => {
    const doc = malformed({
      type: 'blockDocument',
      content: [
        // Image node: no text, no content — contributes nothing.
        { type: 'image', attrs: { src: 'x.png' } },
        // A `text`-typed node whose `text` is not a string is skipped.
        { type: 'text', text: 42 },
        { type: 'paragraph', content: [{ type: 'text', text: 'kept' }] },
      ],
    });
    expect(extractDocumentText(doc)).toBe('kept');
  });

  it('tolerates non-object / null entries inside content without throwing', () => {
    const doc = malformed({
      type: 'blockDocument',
      content: [
        null,
        'a stray string',
        { type: 'paragraph', content: [null, { type: 'text', text: 'survives' }] },
      ],
    });
    expect(extractDocumentText(doc)).toBe('survives');
  });

  it('honours a custom separator', () => {
    const doc: DocumentJSON = {
      type: 'blockDocument',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
      ],
    };
    expect(extractDocumentText(doc, { separator: '\n' })).toBe('one\ntwo');
    expect(extractDocumentText(doc, { separator: '' })).toBe('onetwo');
    expect(extractDocumentText(doc, { separator: undefined })).toBe('one two');
  });
});

describe('inlineDocumentText', () => {
  it('extracts text from an inline document', () => {
    const doc: DocumentJSON = {
      type: 'inlineDocument',
      content: [{ type: 'text', text: 'Inline renderer' }],
    };
    expect(inlineDocumentText(doc)).toBe('Inline renderer');
  });

  it('returns the empty string for empty content', () => {
    expect(inlineDocumentText({ type: 'inlineDocument', content: [] })).toBe('');
  });

  it('concatenates text from multiple nodes with no separator', () => {
    const doc: DocumentJSON = {
      type: 'inlineDocument',
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'World' },
      ],
    };
    expect(inlineDocumentText(doc)).toBe('Hello World');
  });

  it('extracts text ignoring marks', () => {
    const doc: DocumentJSON = {
      type: 'inlineDocument',
      content: [
        { type: 'text', text: 'plain ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
      ],
    };
    expect(inlineDocumentText(doc)).toBe('plain bold and italic');
  });

  it("recurses into a node's nested content to collect inner text", () => {
    // A container node (no own `text`) is descended into so its text children
    // are still collected — the recursive branch of the tree walk.
    const doc: DocumentJSON = {
      type: 'inlineDocument',
      content: [
        { type: 'text', text: 'before ' },
        { type: 'sidenote', content: [{ type: 'text', text: 'inner' }] },
        { type: 'text', text: ' after' },
      ],
    };
    expect(inlineDocumentText(doc)).toBe('before inner after');
  });

  it('returns an empty string for a document with no content array', () => {
    expect(inlineDocumentText(malformed({ type: 'inlineDocument' }))).toBe('');
  });

  it('differs from extractDocumentText exactly in the join', () => {
    const doc: DocumentJSON = {
      type: 'inlineDocument',
      content: [
        { type: 'text', text: 'Rosa ' },
        { type: 'text', text: 'canina', marks: [{ type: 'italic' }] },
      ],
    };
    expect(inlineDocumentText(doc)).toBe('Rosa canina');
    expect(extractDocumentText(doc)).toBe('Rosa  canina');
  });
});
