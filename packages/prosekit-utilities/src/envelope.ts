/**
 * The rename between a stored document's envelope type (`blockDocument`, …)
 * and ProseMirror's top node, always `doc`.
 */

import type { DocumentJSON, NodeJSON } from './json.ts';

/**
 * Rewrites a document's root `type` to `doc`, ready for a ProseMirror
 * schema.
 *
 * Anything that is not already `doc` is treated as an envelope name — the
 * remap does not need to know which one, which is what lets one component
 * serve every envelope an application declares.
 */
export const toEditorDocument = <N extends string>(doc: DocumentJSON<N> | NodeJSON): NodeJSON => ({
  ...doc,
  type: 'doc',
});

/**
 * Rewrites an editor document's root `type` back to the envelope `name`,
 * ready to persist.
 *
 * Curried on the name so a component can bind it once
 * (`const toStored = fromEditorDocument(envelope.name)`). A document with no
 * `content` at all becomes an empty one rather than an envelope missing its
 * required field.
 */
export const fromEditorDocument =
  <N extends string>(name: N) =>
  (doc: NodeJSON): DocumentJSON<N> => ({
    ...doc,
    type: name,
    content: doc.content ?? [],
  });
