/**
 * `@thomasfosterau/prosekit-utilities` — the ProseKit-free surface.
 *
 * Nothing imported from this entry pulls ProseKit or ProseMirror into a
 * bundle: the document shapes, the allow-list checks, text extraction, the
 * Markdown serialiser and the envelope helpers depend on `effect` alone.
 *
 * @module
 */

export {
  allowListFilter,
  allowListViolation,
  checkAllowList,
  defineAllowList,
  DocumentViolation,
  type AllowList,
} from './allow-list.ts';
export {
  defineDocumentShape,
  type DocumentGrammarGuard,
  type DocumentShape,
} from './document-shape.ts';
export { extractDocumentText, inlineDocumentText } from './document-text.ts';
export { fromEditorDocument, toEditorDocument } from './envelope.ts';
export type { DocumentJSON, MarkJSON, NodeJSON } from './json.ts';
export {
  createMarkdownSerialiser,
  escapeMarkdown,
  figureMarkdown,
  mentionMarkdown,
  sidenoteMarkdown,
  toMarkdown,
  type BlockSerialiser,
  type InlineSerialiser,
  type MarkdownContext,
  type MarkdownSerialiser,
  type MarkSerialiser,
} from './markdown/index.ts';
export { DEFAULT_SAFE_SCHEMES, isSafeHref } from './url-safety.ts';
