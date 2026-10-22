import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { describe, expect, it } from 'vite-plus/test';
import {
  deriveAttribute,
  deriveAttrsStruct,
  parseValidateGrammar,
} from '../../src/derive/Attribute.ts';
import type { AttributeOwner } from '../../src/derive/Options.ts';
import { expectSome } from './assert.ts';

const owner: AttributeOwner = { kind: 'node', name: 'test' };

/** `decodeUnknownSync` over an erased `Schema.Top` — see effect-forms/src/Command.ts's identical cast. */
const decodeSync = (schema: Schema.Top) =>
  // SAFETY: every schema these cases build is a context-free codec; `Top`
  // only erases its type parameters, which a sync decode never reads.
  Schema.decodeUnknownSync(schema as Schema.Codec<unknown>);

describe('parseValidateGrammar', () => {
  it('maps a single primitive name', () => {
    const { schema, optional } = parseValidateGrammar('number');
    expect(optional).toBe(false);
    expect(decodeSync(schema)(3)).toBe(3);
    expect(() => decodeSync(schema)('x')).toThrow();
  });

  it('unions multiple primitives', () => {
    const { schema } = parseValidateGrammar('string | null');
    expect(decodeSync(schema)('x')).toBe('x');
    expect(decodeSync(schema)(null)).toBeNull();
    expect(() => decodeSync(schema)(3)).toThrow();
  });

  it('treats an `undefined` member as optionality, not a value', () => {
    const { schema, optional } = parseValidateGrammar('string | undefined');
    expect(optional).toBe(true);
    expect(decodeSync(schema)('x')).toBe('x');
  });

  it('falls back to Unknown for an empty or unrecognised grammar', () => {
    const { schema } = parseValidateGrammar('weird');
    expect(decodeSync(schema)({ any: true })).toEqual({ any: true });
  });
});

describe('deriveAttribute', () => {
  it('prefers a validate hint and marks defaulted keys optional', () => {
    const derived = deriveAttribute(owner, 'level', { default: 1, validate: 'number' });
    expect(derived.optional).toBe(true);
    expect(decodeSync(derived.schema)(2)).toBe(2);
  });

  it('keeps an attribute without a default required', () => {
    const derived = deriveAttribute(owner, 'href', {});
    expect(derived.optional).toBe(false);
  });

  it('infers the schema from a non-null default when validate is absent', () => {
    const derived = deriveAttribute(owner, 'language', { default: 'text' });
    expect(decodeSync(derived.schema)('ts')).toBe('ts');
    expect(() => decodeSync(derived.schema)(3)).toThrow();
  });

  it('consults the overlay before deriving', () => {
    const derived = deriveAttribute(owner, 'level', { default: 1, validate: 'number' }, () =>
      Option.some(Schema.Literals([1, 2, 3])),
    );
    expect(decodeSync(derived.schema)(2)).toBe(2);
    expect(() => decodeSync(derived.schema)(4)).toThrow();
  });
});

describe('deriveAttrsStruct', () => {
  it('returns Option.none() when a type declares no attributes', () => {
    expect(Option.isNone(deriveAttrsStruct(owner, Option.none()))).toBe(true);
    expect(Option.isNone(deriveAttrsStruct(owner, Option.some({})))).toBe(true);
  });

  it('builds a struct with required and optional keys', () => {
    const struct = deriveAttrsStruct(
      owner,
      Option.some({
        href: {},
        title: { default: null },
      }),
    );
    expect(Option.isSome(struct)).toBe(true);
    const decode = decodeSync(expectSome(struct, 'a derived attrs struct'));
    expect(decode({ href: 'x' })).toEqual({ href: 'x' });
    expect(() => decode({ title: null })).toThrow(); // href required
  });
});
