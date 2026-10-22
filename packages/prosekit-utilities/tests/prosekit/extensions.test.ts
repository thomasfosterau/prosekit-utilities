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
import * as Arr from 'effect/Array';
import * as Order from 'effect/Order';
import * as Record from 'effect/Record';
import * as Schema from 'effect/Schema';
import type { MarkType, NodeType, Schema as PmSchema } from '@prosekit/pm/model';
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
import { present } from './fixture.ts';

// The full opt-in grammar, compiled once for the whole file: every opt-in node
// and mark in one schema, which is the composition an application actually
// ships.
const fullSchema = lazySchema(() =>
  defineBlockDocumentExtension(defineMention(), defineFigure(), defineCitation(), defineSidenote()),
);

const blockSchema = lazySchema(() => defineBlockDocumentExtension());
const inlineSchema = lazySchema(() => defineInlineDocumentExtension());

const nodeOf = (schema: PmSchema, name: string): NodeType =>
  present(schema.nodes[name], `node ${name}`);

const markOf = (schema: PmSchema, name: string): MarkType =>
  present(schema.marks[name], `mark ${name}`);

const sortedKeys = <A>(record: Record.ReadonlyRecord<string, A>): ReadonlyArray<string> =>
  Arr.sort(Record.keys(record), Order.String);

// ── The presets ───────────────────────────────────────────────────────

describe('defineBlockDocumentExtension', () => {
  it('registers the stock node set and the nine standard marks, and nothing opt-in', () => {
    const schema = blockSchema();
    Arr.forEach(
      [
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
      ],
      (node) => {
        expect(schema.nodes[node], `node ${node}`).toBeDefined();
      },
    );
    Arr.forEach(
      [
        'bold',
        'italic',
        'underline',
        'strike',
        'code',
        'link',
        'highlight',
        'subscript',
        'superscript',
      ],
      (mark) => {
        expect(schema.marks[mark], `mark ${mark}`).toBeDefined();
      },
    );
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
    Arr.forEach(['mention', 'figure', 'figcaption', 'sidenote'], (node) => {
      expect(schema.nodes[node], `node ${node}`).toBeDefined();
    });
    expect(schema.marks.citation).toBeDefined();
  });
});

describe('defineInlineDocumentExtension', () => {
  it('registers only doc and text — no block node at all', () => {
    const schema = inlineSchema();
    expect(sortedKeys(schema.nodes)).toEqual(['doc', 'text']);
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
    expect(sortedKeys(schema.nodes)).toEqual(['doc', 'paragraph', 'text']);
    expect(Record.keys(schema.marks)).toEqual([]);
  });
});

// ── Opt-in nodes ──────────────────────────────────────────────────────

describe('defineMention', () => {
  it('is an inline atom carrying an id and a label', () => {
    const spec = nodeOf(fullSchema(), 'mention').spec;
    expect(spec.inline).toBe(true);
    expect(spec.atom).toBe(true);
    expect(spec.group).toBe('inline');
  });

  it('renders to a data-attribute span with the `@label` text and no URL attribute', () => {
    const schema = fullSchema();
    const node = nodeOf(schema, 'mention').create({ id: 'u-1', label: 'rosa' });
    expect(present(nodeOf(schema, 'mention').spec.toDOM, 'toDOM')(node)).toEqual([
      'span',
      { 'data-mention-id': 'u-1', 'data-mention-label': 'rosa', class: 'mention' },
      '@rosa',
    ]);
  });

  it('parses `span[data-mention-id]` back into its attributes', () => {
    const schema = fullSchema();
    const rule = present(nodeOf(schema, 'mention').spec.parseDOM?.[0], 'parse rule');
    expect(rule.tag).toBe('span[data-mention-id]');
    const element = document.createElement('span');
    element.setAttribute('data-mention-id', 'u-2');
    element.setAttribute('data-mention-label', 'iris');
    expect(present(rule.getAttrs, 'getAttrs')(element)).toEqual({ id: 'u-2', label: 'iris' });
  });

  it('defaults both attributes to the empty string when the DOM carries neither', () => {
    const schema = fullSchema();
    const rule = present(nodeOf(schema, 'mention').spec.parseDOM?.[0], 'parse rule');
    const element = document.createElement('span');
    element.setAttribute('data-mention-id', '');
    expect(present(rule.getAttrs, 'getAttrs')(element)).toEqual({ id: '', label: '' });
  });

  it('defineMention() returns an extension object', () => {
    expect(defineMention()).toBeTruthy();
  });
});

describe('defineFigure', () => {
  it('holds exactly one image followed by one inline-only caption', () => {
    const schema = fullSchema();
    expect(nodeOf(schema, 'figure').spec.content).toBe('image figcaption');
    expect(nodeOf(schema, 'figure').spec.defining).toBe(true);
    expect(nodeOf(schema, 'figcaption').spec.content).toBe('inline*');
    // A caption cannot nest a block.
    expect(
      nodeOf(schema, 'figcaption').contentMatch.matchType(nodeOf(schema, 'paragraph')),
    ).toBeNull();
  });

  it('renders to <figure> / <figcaption> with content holes', () => {
    const schema = fullSchema();
    const caption = nodeOf(schema, 'figcaption').create(null, schema.text('caption'));
    expect(present(nodeOf(schema, 'figcaption').spec.toDOM, 'toDOM')(caption)).toEqual([
      'figcaption',
      0,
    ]);
    const image = nodeOf(schema, 'image').create({ src: 'https://example.test/a.png' });
    const figure = nodeOf(schema, 'figure').create(null, [image, caption]);
    expect(present(nodeOf(schema, 'figure').spec.toDOM, 'toDOM')(figure)).toEqual(['figure', 0]);
  });

  it('defineFigure() composes the two halves; each half is separately available', () => {
    expect(defineFigure()).toBeTruthy();
    expect(defineFigureNode()).toBeTruthy();
    expect(defineFigcaption()).toBeTruthy();
  });
});

describe('defineSidenote', () => {
  it('is an inline, non-atom, selectable, defining node', () => {
    const spec = nodeOf(fullSchema(), 'sidenote').spec;
    expect(spec.inline).toBe(true);
    expect(spec.group).toContain('inline');
    expect(spec.atom).not.toBe(true);
    expect(spec.selectable).toBe(true);
    expect(spec.defining).toBe(true);
  });

  it('restricts content to `(text | hardBreak)*` so it cannot nest a sidenote', () => {
    const schema = fullSchema();
    const sidenote = nodeOf(schema, 'sidenote');
    const match = sidenote.contentMatch;
    expect(match.matchType(nodeOf(schema, 'text'))).not.toBeNull();
    expect(match.matchType(nodeOf(schema, 'hardBreak'))).not.toBeNull();
    expect(match.matchType(sidenote)).toBeNull();
    // Nor any other inline node the grammar happens to carry.
    expect(match.matchType(nodeOf(schema, 'mention'))).toBeNull();
  });

  it('renders to `<span data-sidenote>` with an inline content hole', () => {
    const schema = fullSchema();
    const node = nodeOf(schema, 'sidenote').create(null, schema.text('aside'));
    expect(present(nodeOf(schema, 'sidenote').spec.toDOM, 'toDOM')(node)).toEqual([
      'span',
      { 'data-sidenote': '' },
      0,
    ]);
  });

  it('defineSidenote() returns an extension object', () => {
    expect(defineSidenote()).toBeTruthy();
  });
});

// ── Marks ─────────────────────────────────────────────────────────────

describe('defineHighlight / defineSubscript / defineSuperscript', () => {
  it('render to their expected DOM tags', () => {
    const schema = blockSchema();
    expect(
      present(markOf(schema, 'highlight').spec.toDOM, 'toDOM')(
        markOf(schema, 'highlight').create(),
        true,
      ),
    ).toEqual(['mark', 0]);
    expect(
      present(markOf(schema, 'subscript').spec.toDOM, 'toDOM')(
        markOf(schema, 'subscript').create(),
        true,
      ),
    ).toEqual(['sub', 0]);
    expect(
      present(markOf(schema, 'superscript').spec.toDOM, 'toDOM')(
        markOf(schema, 'superscript').create(),
        true,
      ),
    ).toEqual(['sup', 0]);
  });

  it('subscript and superscript mutually exclude', () => {
    const schema = blockSchema();
    expect(markOf(schema, 'subscript').spec.excludes).toBe('superscript');
    expect(markOf(schema, 'superscript').spec.excludes).toBe('subscript');
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
    expect(sortedKeys(schema.marks)).toEqual(
      Arr.sort(
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
        ],
        Order.String,
      ),
    );
    expect(defineStandardMarks()).toBeTruthy();
  });
});

describe('defineCitation', () => {
  it('carries the cited work id and renders to <cite data-work-id>', () => {
    const schema = fullSchema();
    const mark = markOf(schema, 'citation').create({ workId: 'w-1' });
    expect(present(markOf(schema, 'citation').spec.toDOM, 'toDOM')(mark, true)).toEqual([
      'cite',
      { 'data-work-id': 'w-1' },
      0,
    ]);
  });

  it('parses `cite[data-work-id]` back into its attribute', () => {
    const rule = present(markOf(fullSchema(), 'citation').spec.parseDOM?.[0], 'parse rule');
    expect(rule.tag).toBe('cite[data-work-id]');
    const element = document.createElement('cite');
    element.setAttribute('data-work-id', 'w-2');
    // SAFETY: a mark parse rule's `getAttrs` is typed for both the `tag` and
    // `style` forms (`HTMLElement & string`); this rule is a `tag` one, so it
    // only ever sees the element.
    expect(present(rule.getAttrs, 'getAttrs')(element as HTMLElement & string)).toEqual({
      workId: 'w-2',
    });
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
    expect(
      isRequiredAttribute(present(STANDARD_ATTRIBUTE_OVERRIDES.heading, 'heading overrides').level),
    ).toBe(true);
    expect(
      isRequiredAttribute(present(STANDARD_ATTRIBUTE_OVERRIDES.list, 'list overrides').kind),
    ).toBe(true);
    expect(
      isRequiredAttribute(present(STANDARD_ATTRIBUTE_OVERRIDES.image, 'image overrides').src),
    ).toBe(true);
    expect(
      isRequiredAttribute(present(STANDARD_ATTRIBUTE_OVERRIDES.image, 'image overrides').width),
    ).toBe(true);
    expect(
      isRequiredAttribute(present(STANDARD_ATTRIBUTE_OVERRIDES.image, 'image overrides').height),
    ).toBe(true);
    expect(
      isRequiredAttribute(
        present(STANDARD_ATTRIBUTE_OVERRIDES.codeBlock, 'codeBlock overrides').language,
      ),
    ).toBe(true);
    expect(
      isRequiredAttribute(present(STANDARD_ATTRIBUTE_OVERRIDES.list, 'list overrides').order),
    ).toBe(false);
    expect(
      isRequiredAttribute(
        present(STANDARD_ATTRIBUTE_OVERRIDES.tableCell, 'tableCell overrides').colwidth,
      ),
    ).toBe(false);
    expect(
      isRequiredAttribute(
        present(STANDARD_ATTRIBUTE_OVERRIDES.tableHeaderCell, 'tableHeaderCell overrides').colwidth,
      ),
    ).toBe(false);
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
    expect(isRequiredAttribute(present(merged.mention, 'mention overrides').id)).toBe(true);
    expect(isRequiredAttribute(present(merged.mention, 'mention overrides').label)).toBe(true);
    // Nothing was mutated.
    expect(STANDARD_ATTRIBUTE_OVERRIDES.mention).toBeUndefined();
    expect(MENTION_ATTRIBUTE_OVERRIDES.heading).toBeUndefined();
  });

  it('merges attribute by attribute within one node, rather than replacing the node', () => {
    const merged = mergeAttributeOverrides(
      { image: { src: Schema.String, width: Schema.Finite } },
      { image: { src: Schema.NullOr(Schema.String) } },
    );
    expect(sortedKeys(present(merged.image, 'image overrides'))).toEqual(['src', 'width']);
    // The later `src` wins.
    expect(present(merged.image, 'image overrides').src).not.toBe(Schema.String);
  });

  it('returns an empty record for no overrides at all', () => {
    expect(mergeAttributeOverrides()).toEqual({});
  });
});
