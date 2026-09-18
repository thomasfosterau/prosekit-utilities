/**
 * Unit tests for the envelope remap.
 *
 * The remap is what stands between a stored `blockDocument` and
 * ProseMirror's `RangeError: Unknown node type: blockDocument`, which takes
 * the hosting page down rather than degrading. Both directions, and the
 * no-mutation guarantee, are pinned here.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import { fromEditorDocument, toEditorDocument } from '../src/envelope.ts';
import type { DocumentJSON, NodeJSON } from '../src/json.ts';

const stored: DocumentJSON<'blockDocument'> = {
  type: 'blockDocument',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
};

describe('toEditorDocument', () => {
  it('rewrites the envelope type to `doc`', () => {
    expect(toEditorDocument(stored)).toEqual({ type: 'doc', content: stored.content });
  });

  it('rewrites any envelope name, not just one', () => {
    expect(toEditorDocument({ type: 'inlineDocument', content: [] }).type).toBe('doc');
    expect(toEditorDocument({ type: 'articleSection', content: [] }).type).toBe('doc');
  });

  it('leaves a document that is already `doc` alone', () => {
    const editorDocument: NodeJSON = { type: 'doc', content: [] };
    expect(toEditorDocument(editorDocument)).toEqual(editorDocument);
  });

  it('returns a new object and never mutates its input', () => {
    const input: DocumentJSON<'blockDocument'> = { type: 'blockDocument', content: [] };
    const output = toEditorDocument(input);
    expect(output).not.toBe(input);
    expect(input.type).toBe('blockDocument');
  });

  it('carries every other field through', () => {
    const withAttrs = { type: 'blockDocument', content: [], attrs: { revision: 3 } } as const;
    expect(toEditorDocument(withAttrs).attrs).toEqual({ revision: 3 });
  });
});

describe('fromEditorDocument', () => {
  const toStored = fromEditorDocument('blockDocument');

  it('rewrites `doc` back to the envelope name', () => {
    expect(toStored({ type: 'doc', content: stored.content })).toEqual(stored);
  });

  it('is curried on the name so a component binds it once', () => {
    expect(fromEditorDocument('inlineDocument')({ type: 'doc', content: [] })).toEqual({
      type: 'inlineDocument',
      content: [],
    });
  });

  it('gives a content-less editor document an empty content array', () => {
    expect(toStored({ type: 'doc' })).toEqual({ type: 'blockDocument', content: [] });
  });

  it('returns a new object and never mutates its input', () => {
    const input: NodeJSON = { type: 'doc', content: [] };
    const output = toStored(input);
    expect(output).not.toBe(input);
    expect(input.type).toBe('doc');
  });

  it('round-trips a stored document unchanged', () => {
    expect(toStored(toEditorDocument(stored))).toEqual(stored);
  });
});
