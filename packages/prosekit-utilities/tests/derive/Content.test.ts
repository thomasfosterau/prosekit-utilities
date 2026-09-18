import { describe, expect, it } from 'vite-plus/test';
import { allowedContentTypes, contentCardinality } from '../../src/derive/Content.ts';
import { testSchema } from './fixture.ts';

describe('contentCardinality', () => {
  it('reports `required` for `block+`', () => {
    expect(contentCardinality(testSchema.nodes.doc)).toBe('required');
    expect(contentCardinality(testSchema.nodes.blockquote)).toBe('required');
  });

  it('reports `optional` for `inline*`', () => {
    expect(contentCardinality(testSchema.nodes.paragraph)).toBe('optional');
    expect(contentCardinality(testSchema.nodes.heading)).toBe('optional');
  });

  it('reports `none` for leaves', () => {
    expect(contentCardinality(testSchema.nodes.image)).toBe('none');
    expect(contentCardinality(testSchema.nodes.horizontalRule)).toBe('none');
    expect(contentCardinality(testSchema.nodes.text)).toBe('none');
  });
});

describe('allowedContentTypes', () => {
  it('collects every node in the referenced group', () => {
    const names = allowedContentTypes(testSchema.nodes.doc).map((t) => t.name);
    expect(names).toEqual(['paragraph', 'heading', 'blockquote', 'image', 'horizontalRule']);
  });

  it('includes the node itself for a recursive grammar', () => {
    const names = allowedContentTypes(testSchema.nodes.blockquote).map((t) => t.name);
    expect(names).toContain('blockquote');
  });

  it('resolves the inline group to text', () => {
    const names = allowedContentTypes(testSchema.nodes.paragraph).map((t) => t.name);
    expect(names).toEqual(['text']);
  });

  it('returns nothing for a leaf', () => {
    expect(allowedContentTypes(testSchema.nodes.image)).toEqual([]);
  });
});
