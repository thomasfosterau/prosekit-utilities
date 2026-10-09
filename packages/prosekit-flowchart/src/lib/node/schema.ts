/**
 * Effect Schema for the flowchart node's persisted `data` attribute.
 *
 * This is the value-type seam a ProseMirror `AttributeSpec` cannot express on
 * its own: `FLOWCHART_ATTRIBUTE_OVERRIDES` (`./overrides.ts`) hands these
 * schemas to a consuming app's `@thomasfosterau/prosekit-utilities/derive`
 * attribute overlay so the derived document schema can decode/encode the
 * flowchart payload precisely, rather than treating it as an opaque blob.
 *
 * The persisted shape is a strict subset of what this package's canvas
 * dependency (Svelte Flow) accepts: only the fields that must survive
 * persistence, so its internal fields (selection, measured dimensions) never
 * round-trip.
 *
 * Ported verbatim from Website's `src/editor/flowchart/schema.ts`.
 *
 * @module @thomasfosterau/prosekit-flowchart/node/schema
 */

import * as Schema from 'effect/Schema';

/**
 * Position of a node on the flowchart canvas.
 *
 * Not exported: nothing outside this module needs the schema value, and
 * `./data.ts` derives the public `FlowchartPosition` type from
 * {@link FlowchartNode}'s `position` field instead, so there is no dead
 * export to carry.
 */
const FlowchartPosition = /* @__PURE__ */ Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});

/** Persisted shape of a single flowchart node. */
export const FlowchartNode = /* @__PURE__ */ Schema.Struct({
  id: Schema.String,
  position: FlowchartPosition,
  data: /* @__PURE__ */ Schema.Struct({ label: Schema.String }),
});

/** The decoded type of {@link FlowchartNode}. */
export type FlowchartNode = typeof FlowchartNode.Type;

/** Persisted shape of a single flowchart edge. */
export const FlowchartEdge = /* @__PURE__ */ Schema.Struct({
  id: Schema.String,
  source: Schema.String,
  target: Schema.String,
});

/** The decoded type of {@link FlowchartEdge}. */
export type FlowchartEdge = typeof FlowchartEdge.Type;

/**
 * Persisted payload stored on the ProseMirror `flowchart` node's `data` attr.
 */
export const FlowchartData = /* @__PURE__ */ Schema.Struct({
  nodes: /* @__PURE__ */ Schema.Array(FlowchartNode),
  edges: /* @__PURE__ */ Schema.Array(FlowchartEdge),
});

/** The decoded type of {@link FlowchartData}. */
export type FlowchartData = typeof FlowchartData.Type;
