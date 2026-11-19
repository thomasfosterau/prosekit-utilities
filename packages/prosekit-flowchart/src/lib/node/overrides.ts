/**
 * The flowchart node's attribute-overlay entry: the Effect Schema for its
 * `data` payload, which ProseMirror's `AttributeSpec` cannot express. Canvas-
 * free, so a server can compose it into a document schema.
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
export const FLOWCHART_ATTRIBUTE_OVERRIDES = {
  flowchart: { data: /* @__PURE__ */ required(FlowchartData) },
} as const satisfies AttributeOverrides;
