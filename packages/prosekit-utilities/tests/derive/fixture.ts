/**
 * A small but representative ProseMirror schema used across the derivation
 * tests: a recursive block grammar (blockquote nests blocks), a leaf with a
 * required attribute (image), a textblock with a numeric attribute (heading),
 * inline text, and two marks (one attribute-less, one with a required
 * attribute).
 */
import { Schema as PmSchema } from '@prosekit/pm/model';

export const testSchema = new PmSchema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: {
      group: 'block',
      content: 'inline*',
      attrs: { level: { default: 1, validate: 'number' } },
    },
    blockquote: { group: 'block', content: 'block+' },
    image: {
      group: 'block',
      // A leaf (no content) with one defaulted and one required attribute.
      attrs: {
        src: { default: null, validate: 'string|null' },
        alt: {},
      },
    },
    horizontalRule: { group: 'block' },
    text: { group: 'inline' },
  },
  marks: {
    bold: {},
    link: {
      attrs: {
        href: {},
        title: { default: null },
      },
    },
  },
});

/**
 * A second schema for the `deriveDocumentSchemas` shared-registry tests: a
 * flat inline-only document with no block nodes at all, but whose `text`
 * node and `bold`/`link` marks are declared with the exact same specs as
 * {@link testSchema} — the "two ProseKit extensions composing the same mark
 * set" shape `deriveDocumentSchemas` targets, just expressed as two
 * independent `PmSchema` instances rather than shared extension objects.
 */
export const inlineTestSchema = new PmSchema({
  topNode: 'inlineDoc',
  nodes: {
    inlineDoc: { content: 'inline*' },
    text: { group: 'inline' },
  },
  marks: {
    bold: {},
    link: {
      attrs: {
        href: {},
        title: { default: null },
      },
    },
  },
});

/**
 * A third schema for the content-model granularity tests: a `figure` whose
 * content expression is a fixed two-element sequence (`image figcaption`),
 * declared the way `defineFigureNode` / `defineFigcaption` declare it. The
 * derivation recovers the child *set* and the non-empty cardinality from it,
 * not the sequence, so these pin exactly what that means at the wire.
 */
export const figureTestSchema = new PmSchema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    image: { group: 'block', attrs: { src: { default: null } } },
    figcaption: { content: 'inline*' },
    figure: { group: 'block', content: 'image figcaption' },
    text: { group: 'inline' },
  },
});
