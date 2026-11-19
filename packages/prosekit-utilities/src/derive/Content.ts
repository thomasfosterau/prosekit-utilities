/**
 * Content-model derivation from ProseMirror's compiled `ContentMatch`
 * automaton. It recovers the set of admissible children and whether content
 * may be empty, not their order: `image figcaption` derives as a non-empty
 * array of either, as ProseMirror's own JSON loading does not check order
 * either.
 */

import * as Arr from 'effect/Array';
import type { ContentMatch, NodeType } from '@prosekit/pm/model';

/** How a node's content model constrains the number of children. */
export type ContentCardinality =
  /** Leaf/atom: no content expression, the node takes no children. */
  | 'none'
  /** `*` / `?`: empty content is valid; the `content` key may be omitted. */
  | 'optional'
  /** `+`: at least one child is required. */
  | 'required';

/**
 * Collects the distinct set of node types that may appear anywhere in a node
 * type's content, by breadth-first walk of its content-match automaton.
 *
 * Order follows first-discovery, which for the typical single-group
 * expression (`block+`, `inline*`) matches the schema's node declaration
 * order.
 */
export function allowedContentTypes(nodeType: NodeType): ReadonlyArray<NodeType> {
  return Arr.dedupeWith(
    Arr.flatMap(reachableMatches([nodeType.contentMatch], []), (match) =>
      Arr.map(edgesOf(match), (edge) => edge.type),
    ),
    (a, b) => a.name === b.name,
  );
}

/** One automaton state's outgoing edges, read through ProseMirror's indexed `edgeCount` / `edge(i)` pair. */
const edgesOf = (match: ContentMatch): ReadonlyArray<ReturnType<ContentMatch['edge']>> =>
  match.edgeCount === 0 ? [] : Arr.makeBy(match.edgeCount, (i) => match.edge(i));

/**
 * Compares automaton states by identity: a compiled `ContentMatch` is its own
 * key, and hashing one would stamp a cached hash onto ProseMirror's objects.
 */
const sameMatch = (a: ContentMatch, b: ContentMatch): boolean => a === b;

/**
 * Every state reachable from `frontier`, in breadth-first discovery order: each
 * level's unvisited states are appended to `visited`, then their successors
 * become the next frontier. The automaton is cyclic, so `visited` is what ends
 * the walk.
 */
function reachableMatches(
  frontier: ReadonlyArray<ContentMatch>,
  visited: ReadonlyArray<ContentMatch>,
): ReadonlyArray<ContentMatch> {
  const fresh = Arr.dedupeWith(
    Arr.filter(frontier, (match) => !Arr.containsWith(sameMatch)(visited, match)),
    sameMatch,
  );
  if (!Arr.isArrayNonEmpty(fresh)) return visited;
  return reachableMatches(
    Arr.flatMap(fresh, (match) => Arr.map(edgesOf(match), (edge) => edge.next)),
    Arr.appendAll(visited, fresh),
  );
}

/**
 * Classifies a node type's content cardinality from its content-match
 * automaton: `none` when it admits no children, `optional` when the empty
 * fragment is a valid end (`*` / `?`), and `required` otherwise (`+`).
 */
export function contentCardinality(nodeType: NodeType): ContentCardinality {
  const match = nodeType.contentMatch;
  if (match.edgeCount === 0) return 'none';
  return match.validEnd ? 'optional' : 'required';
}
