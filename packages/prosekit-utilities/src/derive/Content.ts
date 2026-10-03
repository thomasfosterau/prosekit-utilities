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
 * multiplicity within a content expression are left to ProseMirror's own
 * parser and the editor.
 *
 * @module @thomasfosterau/prosekit-utilities/derive/Content
 */

import * as Array from 'effect/Array';
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
  const result: NodeType[] = [];
  // oxlint-disable-next-line effect/avoid-native-object-helpers -- mutable accumulator inside the worklist below; `HashSet` is immutable and would force reassignment through every nested iteration
  const seenTypes = new Set<string>();
  // oxlint-disable-next-line effect/avoid-native-object-helpers -- keyed on ProseMirror `ContentMatch` *identity*; `HashSet` would stamp a cached hash symbol onto the compiled automaton objects it is given
  const visited = new Set<ContentMatch>();
  const queue: ContentMatch[] = [nodeType.contentMatch];

  // oxlint-disable-next-line effect/imperative-loops -- breadth-first worklist over a cyclic automaton: the queue is appended to while it is drained, which no `Arr.*` combinator expresses
  while (Array.isArrayNonEmpty(queue)) {
    const match = Array.headNonEmpty(queue);
    queue.shift();
    if (visited.has(match)) continue;
    visited.add(match);
    // oxlint-disable-next-line effect/imperative-loops -- ProseMirror exposes edges through the indexed `edgeCount` / `edge(i)` accessor pair, not an array
    for (let i = 0; i < match.edgeCount; i++) {
      const edge = match.edge(i);
      if (!seenTypes.has(edge.type.name)) {
        seenTypes.add(edge.type.name);
        result.push(edge.type);
      }
      queue.push(edge.next);
    }
  }
  return result;
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
