/**
 * The flowchart payload's parser and empty-state default.
 *
 * `FlowchartPosition` is the one convenience type `./schema.ts` deliberately
 * doesn't export on its own (see that module's doc comment); `FlowchartNode`,
 * `FlowchartEdge` and `FlowchartData` are re-exported from `./schema.ts`
 * directly by the package barrel, since each already merges the Effect Schema
 * value and its decoded type under one name.
 *
 * Ported verbatim (semantics unchanged) from Website's
 * `src/editor/flowchart/types.ts`.
 *
 * @module @thomasfosterau/prosekit-flowchart/node/data
 */

import * as Arr from 'effect/Array';
import * as Option from 'effect/Option';
import * as Predicate from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import {
  FlowchartData as FlowchartDataSchema,
  FlowchartEdge as FlowchartEdgeSchema,
  FlowchartNode as FlowchartNodeSchema,
} from './schema.ts';

/** Position of a node on the flowchart canvas. */
export type FlowchartPosition = FlowchartNodeSchema['position'];

/**
 * Parses a JSON string to `unknown`, or `Option.none()` when it is not JSON.
 *
 * Built once at module scope, alongside the per-element decoders below:
 * `parseFlowchartData` runs per flowchart block on every server render, so
 * none of these decoders must be rebuilt per call.
 */
const decodeJson = /* @__PURE__ */ Schema.decodeUnknownOption(
  /* @__PURE__ */ Schema.fromJsonString(Schema.Unknown),
);

/** Decodes a single node, dropping it (via `Option.none()`) if malformed. */
const decodeFlowchartNode = /* @__PURE__ */ Schema.decodeUnknownOption(FlowchartNodeSchema);

/** Decodes a single edge, dropping it (via `Option.none()`) if malformed. */
const decodeFlowchartEdge = /* @__PURE__ */ Schema.decodeUnknownOption(FlowchartEdgeSchema);

/** Empty flowchart payload — used as the default attr value and on parse failure. */
export const EMPTY_FLOWCHART: FlowchartDataSchema = { nodes: [], edges: [] };

/**
 * Parses a JSON string into a `FlowchartData` payload, returning
 * {@link EMPTY_FLOWCHART} on any failure. Validates the shape just enough to
 * make downstream rendering safe.
 *
 * Nodes and edges are validated individually against `FlowchartNode` /
 * `FlowchartEdge` — a single malformed entry is dropped, not the whole array.
 */
export function parseFlowchartData(input: string): FlowchartDataSchema {
  const decoded = decodeJson(input);
  if (Option.isNone(decoded)) return { ...EMPTY_FLOWCHART };
  const parsed = decoded.value;
  if (!Predicate.isObjectOrArray(parsed)) return { ...EMPTY_FLOWCHART };
  const obj = parsed as { nodes?: unknown; edges?: unknown };
  const nodes = Array.isArray(obj.nodes)
    ? Arr.getSomes(obj.nodes.map((node) => decodeFlowchartNode(node)))
    : [];
  const edges = Array.isArray(obj.edges)
    ? Arr.getSomes(obj.edges.map((edge) => decodeFlowchartEdge(edge)))
    : [];
  return { nodes, edges };
}
