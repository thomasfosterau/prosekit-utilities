/**
 * The flowchart node's attribute-overlay entry.
 *
 * `@thomasfosterau/prosekit-utilities/derive` recovers a ProseMirror node's
 * attribute *structure* (its default, whether the key is omissible) but not
 * its value *type* — a caller supplies that through an `AttributeOverlay` /
 * `attributeOverlay()` record. `flowchart.data` is the one attribute this
 * package's node spec owns, so this is the entry a consuming app merges into
 * its own overlay:
 *
 * ```ts
 * import { attributeOverlay } from '@thomasfosterau/prosekit-utilities/derive';
 * import { FLOWCHART_ATTRIBUTE_OVERRIDES } from '@thomasfosterau/prosekit-flowchart/node';
 *
 * const overlay = attributeOverlay({
 *   ...STANDARD_ATTRIBUTE_OVERRIDES,
 *   ...FLOWCHART_ATTRIBUTE_OVERRIDES,
 * });
 * ```
 *
 * Wrapped in `required(...)`: ProseMirror's own rule is that any attribute
 * with a `default` — even one an overlay supplies a value type for — becomes
 * an omissible key, but a live editor's `flowchart` node always serialises
 * `data` in practice (`Node.toJSON()` includes every attr, defaulted or not).
 * Leaving it omissible would let a machine-authored document skip the value
 * the model was supposed to specify (a flowchart with no diagram data)
 * without failing validation.
 *
 * Ported verbatim from the `flowchart: { data: required(FlowchartData) }`
 * entry in Website's `src/editor/document-schema.ts`.
 *
 * @module @thomasfosterau/prosekit-flowchart/node/overrides
 */

import { required, type RequiredAttribute } from '@thomasfosterau/prosekit-utilities/derive';
import type * as Schema from 'effect/Schema';
import { FlowchartData } from './schema.ts';

/**
 * Local restatement of the core's attribute-overrides record shape
 * (`Readonly<Record<string, Readonly<Record<string, Schema.Top |
 * RequiredAttribute>>>>`), the input `attributeOverlay()` consumes.
 *
 * `@thomasfosterau/prosekit-utilities/prosekit` — built in parallel with this
 * package — is expected to export this as `AttributeOverrides`; importing
 * from that entry here would pull ProseKit into a package that has none of
 * it yet, so the shape is restated rather than imported. Not exported: it
 * exists only to type {@link FLOWCHART_ATTRIBUTE_OVERRIDES} below.
 */
type AttributeOverrides = Readonly<
  Record<string, Readonly<Record<string, Schema.Top | RequiredAttribute>>>
>;

/**
 * The flowchart node's attribute overlay: `data` typed as {@link FlowchartData}
 * and required.
 */
export const FLOWCHART_ATTRIBUTE_OVERRIDES: AttributeOverrides = {
  flowchart: { data: required(FlowchartData) },
};
