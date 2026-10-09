/**
 * The attribute overlay this library ships, and how to extend it.
 *
 * ProseMirror exposes a schema's *structure* at runtime but not its attribute
 * *value types*: an `AttributeSpec` carries a `default` and an optional
 * `validate` hint, nothing more. The derivation in
 * `@thomasfosterau/prosekit-utilities/derive` recovers what it can from those
 * and leaves a seam — the attribute overlay — for the rest. This module is
 * that seam pre-filled for ProseKit's stock nodes, plus the merge helper an
 * application uses to add its own entries.
 *
 * @module
 */

import * as Array from 'effect/Array';
import * as Record from 'effect/Record';
import * as Schema from 'effect/Schema';
import { required, type RequiredAttribute } from '../derive/index.ts';

/**
 * The record `attributeOverlay()` consumes: node or mark name, then attribute
 * name, then the Effect Schema for that attribute's value — optionally
 * wrapped in `required(…)`.
 */
export type AttributeOverrides = Readonly<
  Record<string, Readonly<Record<string, Schema.Top | RequiredAttribute>>>
>;

/** The value schema both table cell types' `colwidth` attribute carries. */
const TABLE_CELL_COLWIDTH = /* @__PURE__ */ Schema.NullOr(
  /* @__PURE__ */ Schema.Array(Schema.Finite),
);

/**
 * The overlay for ProseKit's stock nodes — the default when
 * `defineDocumentSchema` is given no `attributes`.
 *
 * Every entry here is either a value type ProseMirror cannot express or a
 * required-ness correction, and nothing else needs one: `link`'s
 * `href`/`target`/`rel`, `list`'s `checked`/`collapsed` and the table cells'
 * `colspan`/`rowspan` all derive correctly from ProseMirror's own `validate`
 * string or default value.
 *
 * **Why `required(…)`.** ProseMirror's rule is that *any* attribute with a
 * `default` — even one this overlay supplies a value type for — becomes an
 * omissible key. But `heading.level`, `list.kind`, `image.src`/`width`/`height`
 * and `codeBlock.language` are attributes a live editor always serialises:
 * `Node.toJSON()` includes every attr, defaulted or not, so an
 * editor-produced document always carries them. Leaving them omissible would
 * let a machine-authored document skip the very value it was supposed to
 * specify — a heading with no level, an image with no source — and still
 * validate. `required(…)` closes that gap. `colwidth` is deliberately *not*
 * wrapped: a cell that has never been resized genuinely has none.
 */
export const STANDARD_ATTRIBUTE_OVERRIDES: AttributeOverrides = {
  heading: { level: /* @__PURE__ */ required(/* @__PURE__ */ Schema.Literals([1, 2, 3, 4, 5, 6])) },
  list: {
    kind: /* @__PURE__ */ required(
      /* @__PURE__ */ Schema.Literals(['bullet', 'ordered', 'task', 'toggle']),
    ),
    order: /* @__PURE__ */ Schema.NullOr(Schema.Finite),
  },
  image: {
    src: /* @__PURE__ */ required(/* @__PURE__ */ Schema.NullOr(Schema.String)),
    width: /* @__PURE__ */ required(/* @__PURE__ */ Schema.NullOr(Schema.Finite)),
    height: /* @__PURE__ */ required(/* @__PURE__ */ Schema.NullOr(Schema.Finite)),
  },
  codeBlock: { language: /* @__PURE__ */ required(Schema.String) },
  tableCell: { colwidth: TABLE_CELL_COLWIDTH },
  tableHeaderCell: { colwidth: TABLE_CELL_COLWIDTH },
};

/**
 * The overlay entry for `defineMention()`, to merge over
 * {@link STANDARD_ATTRIBUTE_OVERRIDES} when a grammar includes the mention
 * node.
 *
 * Both attributes are `required(…)` for the reason above: a mention the editor
 * produced always carries an id and a label, and a mention without an id
 * resolves to nothing.
 */
export const MENTION_ATTRIBUTE_OVERRIDES: AttributeOverrides = {
  mention: {
    id: /* @__PURE__ */ required(Schema.String),
    label: /* @__PURE__ */ required(Schema.String),
  },
};

/**
 * Merges overlays left to right, per node and then per attribute; a later
 * entry wins.
 *
 * ```ts
 * const attributes = mergeAttributeOverrides(
 *   STANDARD_ATTRIBUTE_OVERRIDES,
 *   MENTION_ATTRIBUTE_OVERRIDES,
 * );
 * ```
 *
 * The merge is shallow *per node*: two overlays that both name `image` end up
 * with the union of their attribute entries rather than one replacing the
 * other, so an application can override `image.src` alone without restating
 * `width` and `height`. Nothing is mutated — every call returns a new record.
 */
export const mergeAttributeOverrides = (
  ...overrides: ReadonlyArray<AttributeOverrides>
): AttributeOverrides =>
  Array.reduce(overrides, {} as AttributeOverrides, (merged, current) =>
    Record.union(merged, current, (left, right) => ({ ...left, ...right })),
  );
