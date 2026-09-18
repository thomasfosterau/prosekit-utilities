/**
 * Plain-text extraction from a ProseMirror document.
 *
 * Two joins, because two callers want different things. A search index or an
 * embedding queue wants block text with word boundaries preserved across
 * nodes ({@link extractDocumentText}, `' '`); a title rendered back into
 * prose must not gain spaces its author never typed
 * ({@link inlineDocumentText}, `''`).
 *
 * Both are pure, total and DOM-free, so they run anywhere — including a
 * Worker with no document.
 *
 * @module
 */

import * as Array from 'effect/Array';
import * as Predicate from 'effect/Predicate';
import type { DocumentJSON, NodeJSON } from './json.ts';

/**
 * Extracts plain text from a document, joining the `text` leaves with
 * `options.separator` (default `' '`).
 *
 * Tolerant by design: `null`, `undefined`, a document with no `content`, a
 * stray string or `null` inside `content`, and a `text`-typed node whose
 * `text` is not a string all contribute nothing rather than throwing. The
 * callers are database columns and queue payloads, where a malformed row
 * must degrade to empty text rather than fail a batch.
 */
export function extractDocumentText(
  doc: NodeJSON | DocumentJSON | null | undefined,
  options?: { readonly separator?: string | undefined } | undefined,
): string {
  if (!doc || !doc.content) return '';
  return textParts(doc.content).join(options?.separator ?? ' ');
}

/** The `text` leaves of one node subtree, in document order. */
function textParts(nodes: ReadonlyArray<unknown>): string[] {
  return Array.flatMap(nodes, (node) => {
    if (!Predicate.isObjectOrArray(node)) return [];
    const n = node as Record<string, unknown>;
    const own = n.type === 'text' && Predicate.isString(n.text) ? [n.text] : [];
    return Array.isArray(n.content) ? [...own, ...textParts(n.content)] : own;
  });
}

/**
 * Extracts plain text from an inline document, joining the `text` leaves
 * with nothing at all.
 *
 * This is the form a title or other flat field wants: `extractDocumentText`
 * would turn `Rosa` + `canina` (two runs, one styled) into `Rosa canina`
 * with a space that is already in the first run, or into `Rosacanina` with
 * one missing — the `''` join keeps whatever whitespace the author wrote.
 * Recurses into any node that carries `content`, so a wrapping inline node
 * (a sidenote, a mention) still contributes its text.
 */
export function inlineDocumentText(doc: NodeJSON | DocumentJSON): string {
  return inlineTextParts(doc).join('');
}

/** The `text` leaves of a document subtree, in document order. */
function inlineTextParts(node: NodeJSON | DocumentJSON | undefined): string[] {
  return Array.flatMap(node?.content ?? [], (child) =>
    child.text ? [child.text] : 'content' in child ? inlineTextParts(child) : [],
  );
}
