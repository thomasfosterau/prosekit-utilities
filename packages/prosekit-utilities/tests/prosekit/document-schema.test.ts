/**
 * `defineDocumentSchema`'s own surface: the guard's defect net, the `Effect`
 * decode and its tagged failure, and the install that upgrades a envelope from a
 * structural check to the full grammar.
 *
 * The install cases each build their own envelope pair: installing is a
 * per-isolate, irreversible upgrade, so a suite that installs must not share
 * envelopes with one that asserts the uninstalled behaviour.
 *
 * @module
 */

import { assert, describe, expect, it } from 'vite-plus/test';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import { defineDocumentEnvelope } from '../../src/document-envelope.ts';
import type { NodeJSON } from '../../src/json.ts';
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
  const { block, blockEnvelope } = createDocumentFixture();

  it('carries the envelope it was declared against and its grammar factory', () => {
    expect(block.envelope).toBe(blockEnvelope);
    expect(block.extension).toBeTypeOf('function');
  });

  it('compiles the ProseMirror schema once, on demand', () => {
    const compiled = block.schema();
    expect(compiled).toBe(block.schema());
    expect(compiled.topNodeType.name).toBe('doc');
  });

  it('names the envelope after the envelope, not after ProseMirror`s `doc`', () => {
    expect(Schema.decodeUnknownSync(block.Document)(VALID)).toEqual(VALID);
    expect(() => Schema.decodeUnknownSync(block.Document)({ ...VALID, type: 'doc' })).toThrow(
      'Expected "blockDocument"',
    );
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
    const deep = Arr.reduce(
      Arr.range(1, 60_000),
      { type: 'paragraph', content: [{ type: 'text', text: 'x' }] } satisfies NodeJSON,
      (inner: NodeJSON): NodeJSON => ({ type: 'blockquote', content: [inner] }),
    );
    expect(block.is({ type: 'blockDocument', content: [deep] })).toBe(false);
  });
});

// ── decode ────────────────────────────────────────────────────────────

describe('decode', () => {
  const { block } = createDocumentFixture();

  it('succeeds with the decoded document', () => {
    expect(Effect.runSync(block.decode(VALID))).toEqual(VALID);
  });

  it('fails with a DocumentDecodeError naming the envelope and carrying the issue', () => {
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
  it('upgrades the envelope from a structural check to the full grammar', () => {
    const { block, blockEnvelope } = createDocumentFixture();

    // Before: the envelope is permissive — it checks the envelope and that
    // `content` is an array of JSON, and nothing about the grammar.
    expect(blockEnvelope.isInstalled()).toBe(false);
    expect(blockEnvelope.is(GRAMMAR_INVALID)).toBe(true);

    block.install();

    expect(blockEnvelope.isInstalled()).toBe(true);
    expect(blockEnvelope.is(GRAMMAR_INVALID)).toBe(false);
    expect(blockEnvelope.is(VALID)).toBe(true);
    // The envelope's own codec rejects it too, not just its guard.
    expect(() => Schema.decodeUnknownSync(blockEnvelope.Schema)(GRAMMAR_INVALID)).toThrow(
      'must be a valid block document',
    );
    expect(Schema.decodeUnknownSync(blockEnvelope.Schema)(VALID)).toEqual(VALID);
  });

  it('leaves the structural check in place for things that were never envelopes', () => {
    const { block, blockEnvelope } = createDocumentFixture();
    block.install();
    expect(blockEnvelope.is({ type: 'inlineDocument', content: [] })).toBe(false);
    expect(blockEnvelope.is(null)).toBe(false);
  });
});

describe('installDocumentGrammars', () => {
  it('installs every schema it is given', () => {
    const { block, inline, blockEnvelope, inlineEnvelope } = createDocumentFixture();
    expect(blockEnvelope.isInstalled()).toBe(false);
    expect(inlineEnvelope.isInstalled()).toBe(false);

    installDocumentGrammars(block, inline);

    expect(blockEnvelope.isInstalled()).toBe(true);
    expect(inlineEnvelope.isInstalled()).toBe(true);
    expect(inlineEnvelope.is({ type: 'inlineDocument', content: [{ type: 'paragraph' }] })).toBe(
      false,
    );
  });

  it('installs nothing, and does not throw, when given nothing', () => {
    expect(() => installDocumentGrammars()).not.toThrow();
  });

  it('forces no derivation of its own', () => {
    // Installing stores a guard; it must not compile a grammar. A schema whose
    // extension factory would throw still installs cleanly.
    const envelope = defineDocumentEnvelope({ name: 'blockDocument' });
    const schema = defineDocumentSchema(envelope, {
      extension: () => assert.fail('the grammar must not be compiled by install()'),
    });
    expect(() => installDocumentGrammars(schema)).not.toThrow();
    expect(envelope.isInstalled()).toBe(true);
  });
});

// ── The default overlay ───────────────────────────────────────────────

describe('defineDocumentSchema without an `attributes` option', () => {
  it('falls back to the standard overrides', () => {
    const envelope = defineDocumentEnvelope({ name: 'blockDocument' });
    const schema = defineDocumentSchema(envelope, {
      extension: () => defineBlockDocumentExtension(),
    });
    // `heading.level` is `required(Literals([1..6]))` in the standard overlay.
    expect(() =>
      Schema.decodeSync(schema.Document)({
        type: 'blockDocument',
        content: [{ type: 'heading', attrs: {}, content: [] }],
      }),
    ).toThrow('Expected "paragraph"');
    expect(
      Schema.decodeSync(schema.Document)({
        type: 'blockDocument',
        content: [{ type: 'heading', attrs: { level: 3 }, content: [] }],
      }),
    ).toEqual({
      type: 'blockDocument',
      content: [{ type: 'heading', attrs: { level: 3 }, content: [] }],
    });
  });
});
