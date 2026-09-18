// @vitest-environment happy-dom
/**
 * The node and mark definitions, the two presets, `lazySchema` and the
 * attribute-overlay merge.
 *
 * What these pin is the **grammar**, which is a wire contract: the registered
 * node and mark names, each opt-in node's spec and `toDOM`, the content models
 * that forbid nesting (a caption cannot hold a block; a sidenote cannot hold a
 * sidenote), and the mutual exclusion between `subscript` and `superscript`.
 * The derived wire schema reads all of this off the compiled ProseMirror
 * schema, so a silent change here changes what already-stored documents decode
 * as.
 *
 * Runs under happy-dom: several cases compile a schema through `createEditor`,
 * which reaches for a DOM.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import * as Schema from 'effect/Schema';
import { createEditor, union } from 'prosekit/core';
import { isRequiredAttribute } from '../../src/derive/index.ts';
import {
  MENTION_ATTRIBUTE_OVERRIDES,
  mergeAttributeOverrides,
  STANDARD_ATTRIBUTE_OVERRIDES,
} from '../../src/prosekit/attribute-overrides.ts';
import { lazySchema } from '../../src/prosekit/lazy-schema.ts';
import {
  defineCitation,
  defineHighlight,
  defineStandardMarks,
  defineSubscript,
  defineSuperscript,
} from '../../src/prosekit/marks.ts';
import {
  defineDoc,
  defineFigcaption,
  defineFigure,
  defineFigureNode,
  defineInlineDoc,
  defineMention,
  defineParagraph,
  defineSidenote,
  defineText,
} from '../../src/prosekit/nodes.ts';
import {
  defineBlockDocumentExtension,
  defineEditorBehaviour,
  defineInlineDocumentExtension,
} from '../../src/prosekit/presets.ts';

// The full opt-in grammar, compiled once for the whole file: every opt-in node
// and mark in one schema, which is the composition an application actually
// ships.
const fullSchema = lazySchema(() =>
  defineBlockDocumentExtension(defineMention(), defineFigure(), defineCitation(), defineSidenote()),
);

const blockSchema = lazySchema(() => defineBlockDocumentExtension());
const inlineSchema = lazySchema(() => defineInlineDocumentExtension());

// ── The presets ───────────────────────────────────────────────────────

describe('defineBlockDocumentExtension', () => {
  it('registers the stock node set and the nine standard marks, and nothing opt-in', () => {
    const schema = blockSchema();
    for (const node of [
      'doc',
      'text',
      'paragraph',
      'heading',
      'list',
      'blockquote',
      'image',
      'horizontalRule',
      'hardBreak',
      'table',
      'codeBlock',
    ]) {
      expect(schema.nodes[node], `node ${node}`).toBeDefined();
    }
    for (const mark of [
      'bold',
      'italic',
      'underline',
      'strike',
      'code',
      'link',
      'highlight',
      'subscript',
      'superscript',
    ]) {
      expect(schema.marks[mark], `mark ${mark}`).toBeDefined();
    }
    // Opt-in nodes and marks are absent unless composed in.
    expect(schema.nodes.mention).toBeUndefined();
    expect(schema.nodes.figure).toBeUndefined();
    expect(schema.nodes.figcaption).toBeUndefined();
    expect(schema.nodes.sidenote).toBeUndefined();
    expect(schema.marks.citation).toBeUndefined();
  });

  it('uses `doc` as the top node, with `block+` content', () => {
    expect(blockSchema().topNodeType.name).toBe('doc');
    expect(blockSchema().topNodeType.spec.content).toBe('block+');
  });

  it('unions the extras in — mention, figure, citation and sidenote all register', () => {
    const schema = fullSchema();
    for (const node of ['mention', 'figure', 'figcaption', 'sidenote']) {
      expect(schema.nodes[node], `node ${node}`).toBeDefined();
    }
    expect(schema.marks.citation).toBeDefined();
  });
});

describe('defineInlineDocumentExtension', () => {
  it('registers only doc and text — no block node at all', () => {
    const schema = inlineSchema();
    expect(Object.keys(schema.nodes).sort()).toEqual(['doc', 'text']);
    expect(schema.marks.bold).toBeDefined();
  });

  it('gives the top node `inline*` content', () => {
    expect(inlineSchema().topNodeType.spec.content).toBe('inline*');
  });

  it('compiles independently of the block schema', () => {
    expect(inlineSchema()).not.toBe(blockSchema());
  });
});

describe('defineInlineDoc', () => {
  it('is a top node accepting inline content only', () => {
    const schema = createEditor({
      extension: defineInlineDocumentExtension(),
    }).schema;
    expect(schema.topNodeType.name).toBe('doc');
    expect(schema.topNodeType.spec.content).toBe('inline*');
    expect(defineInlineDoc()).toBeTruthy();
  });
});

describe('defineEditorBehaviour', () => {
  it('registers no node and no mark of its own', () => {
    // Composed over a minimal grammar: whatever the behaviour tail adds, it is
    // not vocabulary, so the derived wire schema is unaffected by it.
    const schema = createEditor({
      extension: union(defineDoc(), defineText(), defineParagraph(), defineEditorBehaviour()),
    }).schema;
    expect(Object.keys(schema.nodes).sort()).toEqual(['doc', 'paragraph', 'text']);
    expect(Object.keys(schema.marks)).toEqual([]);
  });
});

// ── Opt-in nodes ──────────────────────────────────────────────────────

describe('defineMention', () => {
  it('is an inline atom carrying an id and a label', () => {
    const spec = fullSchema().nodes.mention!.spec;
    expect(spec.inline).toBe(true);
    expect(spec.atom).toBe(true);
    expect(spec.group).toBe('inline');
  });

  it('renders to a data-attribute span with the `@label` text and no URL attribute', () => {
    const schema = fullSchema();
    const node = schema.nodes.mention!.create({ id: 'u-1', label: 'rosa' });
    expect(schema.nodes.mention!.spec.toDOM!(node)).toEqual([
      'span',
      { 'data-mention-id': 'u-1', 'data-mention-label': 'rosa', class: 'mention' },
      '@rosa',
    ]);
  });

  it('parses `span[data-mention-id]` back into its attributes', () => {
    const schema = fullSchema();
    const rule = schema.nodes.mention!.spec.parseDOM![0]!;
    expect(rule.tag).toBe('span[data-mention-id]');
    const element = document.createElement('span');
    element.setAttribute('data-mention-id', 'u-2');
    element.setAttribute('data-mention-label', 'iris');
    expect(rule.getAttrs!(element)).toEqual({ id: 'u-2', label: 'iris' });
  });

  it('defaults both attributes to the empty string when the DOM carries neither', () => {
    const schema = fullSchema();
    const rule = schema.nodes.mention!.spec.parseDOM![0]!;
    const element = document.createElement('span');
    element.setAttribute('data-mention-id', '');
    expect(rule.getAttrs!(element)).toEqual({ id: '', label: '' });
  });

  it('defineMention() returns an extension object', () => {
    expect(defineMention()).toBeTruthy();
  });
});

describe('defineFigure', () => {
  it('holds exactly one image followed by one inline-only caption', () => {
    const schema = fullSchema();
    expect(schema.nodes.figure!.spec.content).toBe('image figcaption');
    expect(schema.nodes.figure!.spec.defining).toBe(true);
    expect(schema.nodes.figcaption!.spec.content).toBe('inline*');
    // A caption cannot nest a block.
    expect(schema.nodes.figcaption!.contentMatch.matchType(schema.nodes.paragraph!)).toBeNull();
  });

  it('renders to <figure> / <figcaption> with content holes', () => {
    const schema = fullSchema();
    const caption = schema.nodes.figcaption!.create(null, schema.text('caption'));
    expect(schema.nodes.figcaption!.spec.toDOM!(caption)).toEqual(['figcaption', 0]);
    const image = schema.nodes.image!.create({ src: 'https://example.test/a.png' });
    const figure = schema.nodes.figure!.create(null, [image, caption]);
    expect(schema.nodes.figure!.spec.toDOM!(figure)).toEqual(['figure', 0]);
  });

  it('defineFigure() composes the two halves; each half is separately available', () => {
    expect(defineFigure()).toBeTruthy();
    expect(defineFigureNode()).toBeTruthy();
    expect(defineFigcaption()).toBeTruthy();
  });
});

describe('defineSidenote', () => {
  it('is an inline, non-atom, selectable, defining node', () => {
    const spec = fullSchema().nodes.sidenote!.spec;
    expect(spec.inline).toBe(true);
    expect(spec.group).toContain('inline');
    expect(spec.atom).not.toBe(true);
    expect(spec.selectable).toBe(true);
    expect(spec.defining).toBe(true);
  });

  it('restricts content to `(text | hardBreak)*` so it cannot nest a sidenote', () => {
    const schema = fullSchema();
    const sidenote = schema.nodes.sidenote!;
    const match = sidenote.contentMatch;
    expect(match.matchType(schema.nodes.text!)).not.toBeNull();
    expect(match.matchType(schema.nodes.hardBreak!)).not.toBeNull();
    expect(match.matchType(sidenote)).toBeNull();
    // Nor any other inline node the grammar happens to carry.
    expect(match.matchType(schema.nodes.mention!)).toBeNull();
  });

  it('renders to `<span data-sidenote>` with an inline content hole', () => {
    const schema = fullSchema();
    const node = schema.nodes.sidenote!.create(null, schema.text('aside'));
    expect(schema.nodes.sidenote!.spec.toDOM!(node)).toEqual(['span', { 'data-sidenote': '' }, 0]);
  });

  it('defineSidenote() returns an extension object', () => {
    expect(defineSidenote()).toBeTruthy();
  });
});

// ── Marks ─────────────────────────────────────────────────────────────

describe('defineHighlight / defineSubscript / defineSuperscript', () => {
  it('render to their expected DOM tags', () => {
    const schema = blockSchema();
    expect(schema.marks.highlight!.spec.toDOM!(schema.marks.highlight!.create(), true)).toEqual([
      'mark',
      0,
    ]);
    expect(schema.marks.subscript!.spec.toDOM!(schema.marks.subscript!.create(), true)).toEqual([
      'sub',
      0,
    ]);
    expect(schema.marks.superscript!.spec.toDOM!(schema.marks.superscript!.create(), true)).toEqual(
      ['sup', 0],
    );
  });

  it('subscript and superscript mutually exclude', () => {
    const schema = blockSchema();
    expect(schema.marks.subscript!.spec.excludes).toBe('superscript');
    expect(schema.marks.superscript!.spec.excludes).toBe('subscript');
  });

  it('each is individually composable', () => {
    const schema = createEditor({
      extension: defineBlockDocumentExtension(
        defineHighlight(),
        defineSubscript(),
        defineSuperscript(),
      ),
    }).schema;
    expect(schema.marks.highlight).toBeDefined();
    expect(schema.marks.subscript).toBeDefined();
    expect(schema.marks.superscript).toBeDefined();
  });
});

describe('defineStandardMarks', () => {
  it('is exactly the nine — six stock plus highlight, subscript, superscript', () => {
    const schema = createEditor({
      extension: defineInlineDocumentExtension(),
    }).schema;
    expect(Object.keys(schema.marks).sort()).toEqual(
      [
        'bold',
        'code',
        'highlight',
        'italic',
        'link',
        'strike',
        'subscript',
        'superscript',
        'underline',
      ].sort(),
    );
    expect(defineStandardMarks()).toBeTruthy();
  });
});

describe('defineCitation', () => {
  it('carries the cited work id and renders to <cite data-work-id>', () => {
    const schema = fullSchema();
    const mark = schema.marks.citation!.create({ workId: 'w-1' });
    expect(schema.marks.citation!.spec.toDOM!(mark, true)).toEqual([
      'cite',
      { 'data-work-id': 'w-1' },
      0,
    ]);
  });

  it('parses `cite[data-work-id]` back into its attribute', () => {
    const rule = fullSchema().marks.citation!.spec.parseDOM![0]!;
    expect(rule.tag).toBe('cite[data-work-id]');
    const element = document.createElement('cite');
    element.setAttribute('data-work-id', 'w-2');
    // A mark parse rule's `getAttrs` is typed for both the `tag` and `style`
    // forms (`HTMLElement & string`); this rule is a `tag` one, so it only
    // ever sees the element.
    expect(rule.getAttrs!(element as HTMLElement & string)).toEqual({ workId: 'w-2' });
  });

  it('defineCitation() returns an extension object', () => {
    expect(defineCitation()).toBeTruthy();
  });
});

// ── lazySchema ────────────────────────────────────────────────────────

describe('lazySchema', () => {
  it('compiles once and returns the same instance thereafter', () => {
    let compiles = 0;
    const schema = lazySchema(() => {
      compiles += 1;
      return defineInlineDocumentExtension();
    });
    expect(compiles).toBe(0);
    const first = schema();
    expect(compiles).toBe(1);
    expect(schema()).toBe(first);
    expect(schema()).toBe(first);
    expect(compiles).toBe(1);
  });

  it('gives each thunk its own cache', () => {
    const one = lazySchema(() => defineInlineDocumentExtension());
    const two = lazySchema(() => defineInlineDocumentExtension());
    expect(one()).not.toBe(two());
  });
});

// ── Attribute overrides ───────────────────────────────────────────────

describe('STANDARD_ATTRIBUTE_OVERRIDES', () => {
  it('wraps the always-serialised attributes in required(...) and leaves colwidth optional', () => {
    expect(isRequiredAttribute(STANDARD_ATTRIBUTE_OVERRIDES.heading!.level)).toBe(true);
    expect(isRequiredAttribute(STANDARD_ATTRIBUTE_OVERRIDES.list!.kind)).toBe(true);
    expect(isRequiredAttribute(STANDARD_ATTRIBUTE_OVERRIDES.image!.src)).toBe(true);
    expect(isRequiredAttribute(STANDARD_ATTRIBUTE_OVERRIDES.image!.width)).toBe(true);
    expect(isRequiredAttribute(STANDARD_ATTRIBUTE_OVERRIDES.image!.height)).toBe(true);
    expect(isRequiredAttribute(STANDARD_ATTRIBUTE_OVERRIDES.codeBlock!.language)).toBe(true);
    expect(isRequiredAttribute(STANDARD_ATTRIBUTE_OVERRIDES.list!.order)).toBe(false);
    expect(isRequiredAttribute(STANDARD_ATTRIBUTE_OVERRIDES.tableCell!.colwidth)).toBe(false);
    expect(isRequiredAttribute(STANDARD_ATTRIBUTE_OVERRIDES.tableHeaderCell!.colwidth)).toBe(false);
  });
});

describe('mergeAttributeOverrides', () => {
  it('merges per node, later wins, without mutating either input', () => {
    const merged = mergeAttributeOverrides(
      STANDARD_ATTRIBUTE_OVERRIDES,
      MENTION_ATTRIBUTE_OVERRIDES,
    );
    // Both sides survive.
    expect(merged.heading).toBeDefined();
    expect(isRequiredAttribute(merged.mention!.id)).toBe(true);
    expect(isRequiredAttribute(merged.mention!.label)).toBe(true);
    // Nothing was mutated.
    expect(STANDARD_ATTRIBUTE_OVERRIDES.mention).toBeUndefined();
    expect(MENTION_ATTRIBUTE_OVERRIDES.heading).toBeUndefined();
  });

  it('merges attribute by attribute within one node, rather than replacing the node', () => {
    const merged = mergeAttributeOverrides(
      { image: { src: Schema.String, width: Schema.Finite } },
      { image: { src: Schema.NullOr(Schema.String) } },
    );
    expect(Object.keys(merged.image!).sort()).toEqual(['src', 'width']);
    // The later `src` wins.
    expect(merged.image!.src).not.toBe(Schema.String);
  });

  it('returns an empty record for no overrides at all', () => {
    expect(mergeAttributeOverrides()).toEqual({});
  });
});
