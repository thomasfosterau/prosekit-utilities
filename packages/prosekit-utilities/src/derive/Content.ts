/**
 * @copyright Thomas Foster
 *
 * Content-model derivation — reading a node type's allowed children and
 * cardinality straight from ProseMirror's compiled content expression.
 *
 * A node's content expression (`"block+"`, `"(tableCell | tableHeaderCell)*"`,
 * …) is compiled into a {@link ContentMatch} finite automaton at schema-build
 * time. Rather than re-parse the source string — which ProseMirror also
 * exposes as `spec.content`, but only as an opaque string — we walk that
 * automaton. Every edge names a {@link NodeType} that may appear, and the
 * start state's `validEnd` tells us whether empty content is legal (`*`/`?`
 * style) or at least one child is required (`+`).
 *
 * Walking the DFA is robust for arbitrary expressions and needs no grammar
 * parser of our own; the trade-off is that we recover the *set* of admissible
 * child types and the empty-vs-non-empty distinction, not the full ordered
 * sequence. That is exactly the granularity the derived Effect schema models
 * (an array of a child union). A fixed sequence such as the figure node's
 * `image figcaption` therefore derives as a non-empty array of
 * `image | figcaption`: a stored figure without its caption, or with the two
 * halves reordered, decodes. This is intended: order and per-type
 * multiplicity within a content expression are left to ProseMirror's DOM
 * parser and editing transactions, which enforce them. Loading JSON does not:
 * `schema.nodeFromJSON` (and so ProseKit's `defaultContent`) checks attributes
 * but not content, so such a figure loads unchecked unless the consumer calls
 * `node.check()`, as ProseKit's `editor.setContent` already does.
 *
 * @module @thomasfosterau/prosekit-utilities/derive/Content
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
