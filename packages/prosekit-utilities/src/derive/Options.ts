/**
 * @copyright Thomas Foster
 *
 * Public option and result types for the derivation entry points.
 *
 * ProseMirror exposes a schema's *structure* at runtime — node and mark
 * names, groups, the compiled content model, which marks each node admits,
 * and per-attribute defaults — but it does **not** expose attribute *value
 * types*: an {@link AttributeSpec} carries only a `default` and an optional
 * `validate` hint. So a faithful derivation recovers the structure exactly and
 * makes a best effort at attributes, leaving a seam — the {@link AttributeOverlay}
 * — through which a caller supplies the value schemas ProseMirror cannot. The
 * derived schema complements, rather than replaces, a hand-written generative
 * document contract, which still owns the attribute value types.
 *
 * @module @thomasfosterau/prosekit-utilities/derive/Options
 */

import * as Option from 'effect/Option';
import * as Predicate from 'effect/Predicate';
import type * as Schema from 'effect/Schema';
import type { AttributeSpec } from '@prosekit/pm/model';

/** Identifies the node or mark type that owns an attribute being derived. */
export interface AttributeOwner {
  /** Whether the attribute belongs to a node type or a mark type. */
  readonly kind: 'node' | 'mark';
  /** The owning type's name in the ProseMirror schema. */
  readonly name: string;
}

const RequiredAttributeTypeId: unique symbol = Symbol.for(
  '@thomasfosterau/prosekit-utilities/RequiredAttribute',
);

/**
 * Wraps an overlay schema so the derived attribute key is REQUIRED, overriding
 * ProseMirror's own default-implies-optional rule (a `default` of any value,
 * `null` included, normally makes the key omissible — see
 * {@link import("./Attribute.ts").deriveAttribute}). Use this when the live
 * ProseMirror node always serialises the attribute in practice (every
 * `Node.toJSON()` call includes defaulted attrs, so a genuinely
 * editor-produced document always has the key) and the generative contract
 * should hold a machine-authored document to the same standard.
 */
export interface RequiredAttribute {
  readonly [RequiredAttributeTypeId]: true;
  readonly schema: Schema.Top;
}

/** Wraps `schema` as a {@link RequiredAttribute}. */
export const required = (schema: Schema.Top): RequiredAttribute => ({
  [RequiredAttributeTypeId]: true,
  schema,
});

/** True when `value` is a {@link RequiredAttribute} produced by {@link required}. */
export const isRequiredAttribute = (value: unknown): value is RequiredAttribute =>
  Predicate.isObjectOrArray(value) && RequiredAttributeTypeId in value;

/**
 * A caller-supplied override for a single attribute's schema.
 *
 * Return `Option.some` of an Effect {@link Schema.Top} to replace the derived
 * attribute schema (key optionality still follows ProseMirror's `default`), of
 * a {@link required} wrapper to additionally force the key required, or
 * `Option.none()` to fall back to the automatic derivation (validate hint →
 * default `typeof` → `Schema.Unknown`). This is where the attribute value types
 * ProseMirror cannot introspect are supplied by hand.
 */
export type AttributeOverlay = (
  owner: AttributeOwner,
  attribute: string,
  spec: AttributeSpec,
) => Option.Option<Schema.Top | RequiredAttribute>;

/** Options common to every derivation entry point. */
export interface DeriveOptions {
  /**
   * Overrides derived attribute schemas. Consulted before the automatic
   * derivation for every node and mark attribute.
   */
  readonly attributes?: AttributeOverlay;
  /**
   * Whether to attach a `marks` field to nodes that admit marks. Defaults to
   * `true`; set `false` to omit marks entirely (e.g. a plain-text contract).
   */
  readonly includeMarks?: boolean;
  /**
   * Emit `content: "block+"` and other required content models as a
   * non-empty array (`Schema.NonEmptyArray`) rather than a possibly-empty
   * `Schema.Array`. Defaults to `true` — it mirrors ProseMirror's own
   * non-emptiness guarantee. Set `false` for a more lenient generative
   * contract.
   */
  readonly nonEmptyRequiredContent?: boolean;
}

/** Options for {@link deriveDocumentSchema}. */
export interface DeriveDocumentOptions extends DeriveOptions {
  /**
   * Overrides the top node's `type` literal. ProseMirror's top node is
   * usually named `doc`; an application that renames it at its own layer
   * (e.g. `doc` → `blockDocument`) passes the app-layer name here so the
   * derived envelope matches its persisted JSON.
   */
  readonly topTypeName?: string;
}

/** A derived ProseMirror mark, as its JSON shape. */
export interface DerivedMarkJSON {
  readonly type: string;
  readonly attrs?: Record<string, unknown>;
}

/** A derived ProseMirror node, as its recursive JSON shape. */
export interface DerivedNodeJSON {
  readonly type: string;
  readonly attrs?: Record<string, unknown>;
  readonly content?: ReadonlyArray<DerivedNodeJSON>;
  readonly marks?: ReadonlyArray<DerivedMarkJSON>;
  readonly text?: string;
}

/**
 * Builds an {@link AttributeOverlay} from a nested record keyed by owner name
 * then attribute name. A convenience over writing the function by hand when the
 * overrides are static:
 *
 * ```ts
 * const overlay = attributeOverlay({
 *   heading: { level: Schema.Literals([1, 2, 3, 4, 5, 6]) },
 *   image: { src: Schema.NullOr(Schema.String) },
 * });
 * ```
 *
 * Keys match on the owning type's name regardless of whether it is a node or a
 * mark; a node and a mark sharing a name (unusual) would share overrides.
 */
export function attributeOverlay(
  overrides: Readonly<Record<string, Readonly<Record<string, Schema.Top | RequiredAttribute>>>>,
): AttributeOverlay {
  return (owner, attribute) => Option.fromNullishOr(overrides[owner.name]?.[attribute]);
}
