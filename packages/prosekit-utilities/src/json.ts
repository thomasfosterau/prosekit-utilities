/**
 * The ProseMirror JSON shapes, declared here rather than imported.
 *
 * `prosekit/core` exports a `NodeJSON` interface of exactly this shape, but
 * importing it — even as a type — would put `prosekit` in this entry's
 * import graph, and a `verbatimModuleSyntax` type-only import is easy to
 * turn into a value import by accident. The root entry's whole purpose is
 * that a model layer can name a document type without the editor runtime
 * reaching the bundle, so the types are restated here instead.
 *
 * These are structural twins: `prosekit/core`'s `NodeJSON` is assignable to
 * {@link NodeJSON} and vice versa where the mutability allows, so a document
 * read out of an editor passes straight into anything here.
 *
 * @module
 */

/**
 * One ProseMirror mark in its JSON form — a type name and its attributes.
 *
 * `attrs` is `unknown`-valued rather than `any`-valued: a serialiser that
 * reads `mark.attrs?.href` has to narrow it, which is what keeps the
 * `isSafeHref` check from being accidentally skipped.
 */
export interface MarkJSON {
  readonly type: string;
  readonly attrs?: Record<string, unknown> | undefined;
}

/**
 * One ProseMirror node in its JSON form.
 *
 * Every field but `type` is optional, exactly as ProseMirror's own
 * serialisation is: a text leaf carries `text`, a container carries
 * `content`, an atom carries neither.
 */
export interface NodeJSON {
  readonly type: string;
  readonly attrs?: Record<string, unknown> | undefined;
  readonly content?: ReadonlyArray<NodeJSON> | undefined;
  readonly marks?: ReadonlyArray<MarkJSON> | undefined;
  readonly text?: string | undefined;
}

/**
 * The persisted document envelope: a ProseMirror document whose top-level
 * `type` is the application's own name for the surface (`blockDocument`,
 * `inlineDocument`, …) rather than ProseMirror's `doc`.
 *
 * Storing the surface name in the envelope is what lets one column's rows
 * say which grammar they were written under; {@link NodeJSON} is what the
 * editor itself wants, and `toEditorDocument` / `fromEditorDocument` move
 * between the two.
 */
export interface DocumentJSON<Name extends string = string> {
  readonly type: Name;
  readonly content: ReadonlyArray<NodeJSON>;
}
