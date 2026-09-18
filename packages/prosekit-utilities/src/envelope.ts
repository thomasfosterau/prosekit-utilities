/**
 * The envelope remap between a stored document and an editor document.
 *
 * A persisted document's root `type` is the application's own name for the
 * surface (`blockDocument`, `inlineDocument`, …); a compiled ProseMirror
 * schema's top node is always `doc`. Feeding the stored shape straight into
 * an editor throws `RangeError: Unknown node type: blockDocument` and takes
 * the hosting page down with it, so every boundary between the two — the
 * editor component, the HTML renderer — remaps in both directions.
 *
 * Both helpers return a new object. A document read out of an editor or off
 * a store is shared with whatever else holds it, and mutating its `type` in
 * place has broken a downstream read more than once.
 *
 * @module
 */

import type { DocumentJSON, NodeJSON } from './json.ts';

/**
 * Rewrites a document's root `type` to `doc`, ready for a ProseMirror
 * schema.
 *
 * Anything that is not already `doc` is treated as an envelope name — the
 * remap does not need to know which one, which is what lets one component
 * serve every shape an application declares.
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
 * (`const toStored = fromEditorDocument(shape.name)`). A document with no
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
