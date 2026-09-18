/**
 * Markdown serialisation for ProseKit documents.
 *
 * `createMarkdownSerialiser` builds one; `toMarkdown` is the ready-made
 * instance over the shared base grammar; the entries in `./optional.ts`
 * cover the opt-in nodes an application composes in.
 *
 * @module
 */

import { createMarkdownSerialiser, type MarkdownSerialiser } from './serialiser.ts';

export { escapeMarkdown } from './escape.ts';
export { figureMarkdown, mentionMarkdown, sidenoteMarkdown } from './optional.ts';
export {
  createMarkdownSerialiser,
  type BlockSerialiser,
  type InlineSerialiser,
  type MarkdownContext,
  type MarkdownSerialiser,
  type MarkSerialiser,
} from './serialiser.ts';

/**
 * The default serialiser: the shared base grammar and nothing else.
 *
 * An application whose grammar includes an opt-in node builds its own with
 * `createMarkdownSerialiser` rather than reaching for this one, because a
 * node with no serialiser falls back to its inline text — readable, but not
 * a faithful rendering of a figure or a sidenote.
 */
export const toMarkdown: MarkdownSerialiser = createMarkdownSerialiser();
