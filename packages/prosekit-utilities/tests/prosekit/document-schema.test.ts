/**
 * `defineDocumentSchema`'s own surface: the guard's defect net, the `Effect`
 * decode and its tagged failure, and the install that upgrades a shape from a
 * structural check to the full grammar.
 *
 * The install cases each build their own shape pair: installing is a
 * per-isolate, irreversible upgrade, so a suite that installs must not share
 * shapes with one that asserts the uninstalled behaviour.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import { defineDocumentShape } from '../../src/document-shape.ts';
import {
  defineDocumentSchema,
  DocumentDecodeError,
  installDocumentGrammars,
} from '../../src/prosekit/document-schema.ts';
import { defineBlockDocumentExtension } from '../../src/prosekit/presets.ts';
import { createDocumentFixture } from './fixture.ts';

const VALID = {
  type: 'blockDocument',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
};

// A structurally valid envelope the compiled grammar rejects: `notARealNode`
// is in no node registry, but `content` is still an array of JSON.
const GRAMMAR_INVALID = { type: 'blockDocument', content: [{ type: 'notARealNode' }] };

// ── The pieces a document schema hands back ───────────────────────────

describe('defineDocumentSchema', () => {
  const { block, blockShape } = createDocumentFixture();

  it('carries the shape it was declared against and its grammar factory', () => {
    expect(block.shape).toBe(blockShape);
    expect(typeof block.extension).toBe('function');
  });

  it('compiles the ProseMirror schema once, on demand', () => {
    const compiled = block.schema();
    expect(compiled).toBe(block.schema());
    expect(compiled.topNodeType.name).toBe('doc');
  });

  it('names the envelope after the shape, not after ProseMirror`s `doc`', () => {
    expect(Schema.decodeUnknownSync(block.Document)(VALID)).toEqual(VALID);
    expect(() => Schema.decodeUnknownSync(block.Document)({ ...VALID, type: 'doc' })).toThrow();
  });
});

// ── is ────────────────────────────────────────────────────────────────

describe('is', () => {
  const { block } = createDocumentFixture();

  it('accepts a grammar-valid document and rejects one the grammar refuses', () => {
    expect(block.is(VALID)).toBe(true);
    expect(block.is(GRAMMAR_INVALID)).toBe(false);
  });

  it('returns false rather than throwing for values that are not documents at all', () => {
    expect(block.is(null)).toBe(false);
    expect(block.is(undefined)).toBe(false);
    expect(block.is('nope')).toBe(false);
    expect(block.is(42)).toBe(false);
    expect(block.is([])).toBe(false);
  });

  it('catches a defect — a document deep enough to exhaust the stack degrades to false', () => {
    // The net exists because `Schema.is` only converts ordinary schema issues
    // into `false`; a genuine defect (stack exhaustion while walking the
    // recursive struct/union graph) propagates as a raw exception, and this
    // runs on render paths where an uncaught throw takes the page down.
    let deep: unknown = { type: 'paragraph', content: [{ type: 'text', text: 'x' }] };
    for (let depth = 0; depth < 60_000; depth += 1) {
      deep = { type: 'blockquote', content: [deep] };
    }
    expect(block.is({ type: 'blockDocument', content: [deep] })).toBe(false);
  });
});

// ── decode ────────────────────────────────────────────────────────────

describe('decode', () => {
  const { block } = createDocumentFixture();

  it('succeeds with the decoded document', () => {
    expect(Effect.runSync(block.decode(VALID))).toEqual(VALID);
  });

  it('fails with a DocumentDecodeError naming the shape and carrying the issue', () => {
    const exit = Effect.runSyncExit(block.decode(GRAMMAR_INVALID));
    expect(Exit.isFailure(exit)).toBe(true);
    const error = Effect.runSync(Effect.flip(block.decode(GRAMMAR_INVALID)));
    expect(error).toBeInstanceOf(DocumentDecodeError);
    expect(error._tag).toBe('DocumentDecodeError');
    expect(error.document).toBe('blockDocument');
    expect(error.issue).toBeDefined();
  });

  it('fails the same way for a value that is not a document at all', () => {
    const error = Effect.runSync(Effect.flip(block.decode(null)));
    expect(error._tag).toBe('DocumentDecodeError');
    expect(error.document).toBe('blockDocument');
  });

  it('is catchable by tag', () => {
    const recovered = Effect.runSync(
      block
        .decode(GRAMMAR_INVALID)
        .pipe(Effect.catchTag('DocumentDecodeError', (error) => Effect.succeed(error.document))),
    );
    expect(recovered).toBe('blockDocument');
  });
});

// ── install ───────────────────────────────────────────────────────────

describe('install', () => {
  it('upgrades the shape from a structural check to the full grammar', () => {
    const { block, blockShape } = createDocumentFixture();

    // Before: the shape is permissive — it checks the envelope and that
    // `content` is an array of JSON, and nothing about the grammar.
    expect(blockShape.isInstalled()).toBe(false);
    expect(blockShape.is(GRAMMAR_INVALID)).toBe(true);

    block.install();

    expect(blockShape.isInstalled()).toBe(true);
    expect(blockShape.is(GRAMMAR_INVALID)).toBe(false);
    expect(blockShape.is(VALID)).toBe(true);
    // The shape's own codec rejects it too, not just its guard.
    expect(() => Schema.decodeUnknownSync(blockShape.Schema)(GRAMMAR_INVALID)).toThrow();
    expect(Schema.decodeUnknownSync(blockShape.Schema)(VALID)).toEqual(VALID);
  });

  it('leaves the structural check in place for things that were never envelopes', () => {
    const { block, blockShape } = createDocumentFixture();
    block.install();
    expect(blockShape.is({ type: 'inlineDocument', content: [] })).toBe(false);
    expect(blockShape.is(null)).toBe(false);
  });
});

describe('installDocumentGrammars', () => {
  it('installs every schema it is given', () => {
    const { block, inline, blockShape, inlineShape } = createDocumentFixture();
    expect(blockShape.isInstalled()).toBe(false);
    expect(inlineShape.isInstalled()).toBe(false);

    installDocumentGrammars(block, inline);

    expect(blockShape.isInstalled()).toBe(true);
    expect(inlineShape.isInstalled()).toBe(true);
    expect(inlineShape.is({ type: 'inlineDocument', content: [{ type: 'paragraph' }] })).toBe(
      false,
    );
  });

  it('installs nothing, and does not throw, when given nothing', () => {
    expect(() => installDocumentGrammars()).not.toThrow();
  });

  it('forces no derivation of its own', () => {
    // Installing stores a guard; it must not compile a grammar. A schema whose
    // extension factory would throw still installs cleanly.
    const shape = defineDocumentShape({ name: 'blockDocument' });
    const schema = defineDocumentSchema(shape, {
      extension: () => {
        throw new Error('the grammar must not be compiled by install()');
      },
    });
    expect(() => installDocumentGrammars(schema)).not.toThrow();
    expect(shape.isInstalled()).toBe(true);
  });
});

// ── The default overlay ───────────────────────────────────────────────

describe('defineDocumentSchema without an `attributes` option', () => {
  it('falls back to the standard overrides', () => {
    const shape = defineDocumentShape({ name: 'blockDocument' });
    const schema = defineDocumentSchema(shape, {
      extension: () => defineBlockDocumentExtension(),
    });
    // `heading.level` is `required(Literals([1..6]))` in the standard overlay.
    expect(() =>
      Schema.decodeUnknownSync(schema.Document)({
        type: 'blockDocument',
        content: [{ type: 'heading', attrs: {}, content: [] }],
      }),
    ).toThrow();
    expect(
      Schema.decodeUnknownSync(schema.Document)({
        type: 'blockDocument',
        content: [{ type: 'heading', attrs: { level: 3 }, content: [] }],
      }),
    ).toEqual({
      type: 'blockDocument',
      content: [{ type: 'heading', attrs: { level: 3 }, content: [] }],
    });
  });
});
