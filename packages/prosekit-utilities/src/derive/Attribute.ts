/**
 * @copyright Thomas Foster
 *
 * Attribute derivation — the part of a ProseMirror schema that is only
 * *partially* recoverable at runtime.
 *
 * An {@link AttributeSpec} carries a `default` and an optional `validate`
 * hint, nothing more. So this module recovers what it can, in priority order:
 *
 * 1. A caller {@link AttributeOverlay} override, if one is supplied.
 * 2. The `validate` string grammar (`"number | string | null"` …), parsed
 *    into a union of primitives — this is the one place ProseMirror records an
 *    attribute's value type.
 * 3. The `typeof` of a non-null `default` value.
 * 4. `Schema.Unknown` as the last resort.
 *
 * Key optionality follows ProseMirror's own rule: an attribute with a
 * `default` (of any value, `null` included) may be omitted and is emitted as
 * an optional key; an attribute with no default is required — the same split
 * `NodeType.hasRequiredAttrs()` reports.
 *
 * @module @thomasfosterau/prosekit-utilities/derive/Attribute
 */

import * as Array from 'effect/Array';
import * as Option from 'effect/Option';
import * as Predicate from 'effect/Predicate';
import * as Record from 'effect/Record';
import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';
import * as String from 'effect/String';
import type { AttributeSpec } from '@prosekit/pm/model';
import { isRequiredAttribute, type AttributeOwner, type AttributeOverlay } from './Options.ts';

/** A single derived attribute: its value schema and whether the key is optional. */
export interface DerivedAttribute {
  readonly schema: Schema.Top;
  /** True when the attribute has a default and may be omitted from the JSON. */
  readonly optional: boolean;
}

const PRIMITIVE_BY_NAME: Readonly<Record<string, Schema.Top>> = {
  string: Schema.String,
  number: Schema.Finite,
  boolean: Schema.Boolean,
  null: Schema.Null,
};

/**
 * Parses ProseMirror's `validate` string grammar — a `|`-separated list of the
 * primitive names `"string"`, `"number"`, `"boolean"`, `"null"`, and
 * `"undefined"` — into an Effect schema.
 *
 * The `"undefined"` member is not represented as a value (there is no
 * first-class `undefined` schema for a present key); it is reported via the
 * returned `optional` flag so the caller can drop the key instead.
 *
 * An empty or all-unknown grammar yields `Schema.Unknown`.
 */
export function parseValidateGrammar(validate: string): {
  readonly schema: Schema.Top;
  readonly optional: boolean;
} {
  const tokens = validate
    .split('|')
    .map((t) => t.trim())
    .filter(String.isNonEmpty);
  const optional = tokens.includes('undefined');
  // Dedupe by token so `"string | string"` collapses; `Schema.Unknown`
  // members from unrecognised tokens dedupe under the empty key.
  const keys = Array.dedupe(
    Array.filterMap(tokens, (token): Result.Result<string, void> =>
      token === 'undefined'
        ? Result.failVoid
        : Result.succeed(token in PRIMITIVE_BY_NAME ? token : ''),
    ),
  );
  const members = Array.map(keys, (key) => PRIMITIVE_BY_NAME[key] ?? Schema.Unknown);
  return Array.match(members, {
    onEmpty: () => ({ schema: Schema.Unknown, optional }),
    onNonEmpty: (present) =>
      present.length === 1
        ? { schema: Array.headNonEmpty(present), optional }
        : { schema: Schema.Union(members), optional },
  });
}

/** Best-effort schema for an attribute value inferred from its default. */
function schemaFromDefault(value: unknown): Schema.Top {
  if (Predicate.isString(value)) return Schema.String;
  if (Predicate.isNumber(value)) return Schema.Finite;
  if (Predicate.isBoolean(value)) return Schema.Boolean;
  // `null`, arrays, and objects carry no recoverable element/field types,
  // so fall back to `Unknown` (refine via an attribute overlay).
  return value === null ? Schema.NullOr(Schema.Unknown) : Schema.Unknown;
}

/**
 * Derives the schema and key-optionality for one node or mark attribute.
 *
 * @param owner  The node or mark type the attribute belongs to (for the overlay).
 * @param name   The attribute name.
 * @param spec   The ProseMirror attribute spec.
 * @param overlay Optional caller override consulted first.
 */
export function deriveAttribute(
  owner: AttributeOwner,
  name: string,
  spec: AttributeSpec,
  overlay?: AttributeOverlay,
): DerivedAttribute {
  const hasDefault = spec.default !== undefined;
  const override = overlay === undefined ? Option.none() : overlay(owner, name, spec);
  if (Option.isSome(override)) {
    const value = override.value;
    if (isRequiredAttribute(value)) return { schema: value.schema, optional: false };
    return { schema: value, optional: hasDefault };
  }

  if (Predicate.isString(spec.validate)) {
    const { schema, optional } = parseValidateGrammar(spec.validate);
    // A `default` also makes the key omissible, independent of an
    // `"undefined"` member in the grammar.
    return { schema, optional: optional || hasDefault };
  }

  // A function validator is opaque; fall back to the default's shape.
  return {
    schema: hasDefault ? schemaFromDefault(spec.default) : Schema.Unknown,
    optional: hasDefault,
  };
}

/**
 * Derives the `attrs` struct schema for a node or mark from its attribute
 * specs, or `Option.none()` when the type declares no attributes.
 *
 * `attrs` is an `Option` because ProseMirror's own `NodeSpec`/`MarkSpec` leaves
 * `attrs` absent for an attribute-less type — the caller converts that foreign
 * `undefined` at the boundary (`Option.fromNullishOr(nodeType.spec.attrs)`).
 */
export function deriveAttrsStruct(
  owner: AttributeOwner,
  attrs: Option.Option<Readonly<Record<string, AttributeSpec>>>,
  overlay?: AttributeOverlay,
): Option.Option<Schema.Top> {
  if (Option.isNone(attrs) || Record.isEmptyReadonlyRecord(attrs.value)) return Option.none();
  const fields: Record<string, Schema.Top> = Record.map(attrs.value, (spec, name) => {
    const { schema, optional } = deriveAttribute(owner, name, spec, overlay);
    return optional ? Schema.optionalKey(schema) : schema;
  });
  return Option.some(Schema.Struct(fields));
}
