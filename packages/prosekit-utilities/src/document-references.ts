/**
 * Reference extraction from a ProseMirror document: who it mentions and which
 * works it cites.
 *
 * A stored document's references feed an index of their own (a "mentioned
 * in" list, a backlink table, a notification fan-out), kept in step with the
 * document at write time. Both walks read the JSON tree directly, so they are
 * pure, total and DOM-free, and the editor runtime never reaches the caller's
 * bundle.
 *
 * They read this package's own wire shapes: the `mention` node's
 * `{ id, label }` attributes and the `citation` mark's `workId`.
 *
 * @module
 */

import * as Array from 'effect/Array';
import * as Option from 'effect/Option';
import * as Predicate from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import type { DocumentJSON, NodeJSON } from './json.ts';

/** One mentioned entity, as the `mention` node stores it. */
export interface DocumentMention {
  readonly id: string;
  readonly label: string;
}

/**
 * Lists the entities a document mentions, one entry per distinct `id`, in
 * the order each is first mentioned.
 *
 * When one `id` is mentioned more than once, the first occurrence's `label`
 * is kept. Tolerant in the same way as `extractDocumentText`: `null`,
 * `undefined`, a document with no `content`, stray non-object entries and a
 * mention whose `id` is not a non-empty string (the node's default is `''`,
 * an unresolved mention) all contribute nothing rather than throwing. A
 * mention whose `label` is not a string is kept with an empty label.
 */
export function extractMentions(
  doc: NodeJSON | DocumentJSON | null | undefined,
): ReadonlyArray<DocumentMention> {
  if (!doc || !doc.content) return [];
  return Array.dedupeWith(mentionParts(doc.content), (a, b) => a.id === b.id);
}

/**
 * Lists the works a document cites (the `citation` mark's `workId`), one
 * entry per distinct id, in the order each is first cited.
 *
 * Tolerant in the same way as {@link extractMentions}: a mark whose `workId`
 * is not a non-empty string contributes nothing.
 */
export function extractCitations(
  doc: NodeJSON | DocumentJSON | null | undefined,
): ReadonlyArray<string> {
  if (!doc || !doc.content) return [];
  return Array.dedupe(citationParts(doc.content));
}

/** A `mention` node with a usable id; its `label` is read leniently. */
const decodeMention = /* @__PURE__ */ Schema.decodeUnknownOption(
  /* @__PURE__ */ Schema.Struct({
    type: /* @__PURE__ */ Schema.Literal('mention'),
    attrs: /* @__PURE__ */ Schema.Struct({
      id: Schema.NonEmptyString,
      label: /* @__PURE__ */ Schema.optionalKey(Schema.Unknown),
    }),
  }),
);

/** A `citation` mark with a usable work id. */
const decodeCitation = /* @__PURE__ */ Schema.decodeUnknownOption(
  /* @__PURE__ */ Schema.Struct({
    type: /* @__PURE__ */ Schema.Literal('citation'),
    attrs: /* @__PURE__ */ Schema.Struct({ workId: Schema.NonEmptyString }),
  }),
);

/** The mentions of one node subtree, in document order, duplicates kept. */
function mentionParts(nodes: ReadonlyArray<unknown>): Array<DocumentMention> {
  return Array.flatMap(nodes, (node) => {
    if (!Predicate.isObject(node)) return [];
    const own = Array.fromOption(
      Option.map(decodeMention(node), ({ attrs }) => ({
        id: attrs.id,
        label: Predicate.isString(attrs.label) ? attrs.label : '',
      })),
    );
    return Predicate.hasProperty(node, 'content') && Array.isArray(node.content)
      ? [...own, ...mentionParts(node.content)]
      : own;
  });
}

/** The cited work ids of one node subtree, in document order, duplicates kept. */
function citationParts(nodes: ReadonlyArray<unknown>): Array<string> {
  return Array.flatMap(nodes, (node) => {
    if (!Predicate.isObject(node)) return [];
    const marks: ReadonlyArray<unknown> =
      Predicate.hasProperty(node, 'marks') && Array.isArray(node.marks) ? node.marks : [];
    const own = Array.flatMap(marks, (mark) =>
      Array.fromOption(Option.map(decodeCitation(mark), ({ attrs }) => attrs.workId)),
    );
    return Predicate.hasProperty(node, 'content') && Array.isArray(node.content)
      ? [...own, ...citationParts(node.content)]
      : own;
  });
}
