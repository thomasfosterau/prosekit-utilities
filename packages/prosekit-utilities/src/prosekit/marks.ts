/**
 * Mark extensions: ProseKit's stock set plus this library's `highlight`,
 * `subscript`, `superscript` and opt-in `citation`. These keep the attribute
 * shapes stored documents already use, so never swap in ProseKit's same-named
 * marks.
 */

import * as Option from 'effect/Option';
import * as P from 'effect/Predicate';
import { defineMarkSpec, union } from 'prosekit/core';
import { defineBold } from 'prosekit/extensions/bold';
import { defineCode } from 'prosekit/extensions/code';
import { defineItalic } from 'prosekit/extensions/italic';
import { defineLink } from 'prosekit/extensions/link';
import { defineStrike } from 'prosekit/extensions/strike';
import { defineUnderline } from 'prosekit/extensions/underline';

// ---------------------------------------------------------------------------
// ProseKit stock mark extensions, re-exported
// ---------------------------------------------------------------------------

export { defineBold, type BoldExtension } from 'prosekit/extensions/bold';
export { defineItalic, type ItalicExtension } from 'prosekit/extensions/italic';
export { defineUnderline, type UnderlineExtension } from 'prosekit/extensions/underline';
export { defineStrike, type StrikeExtension } from 'prosekit/extensions/strike';
export { defineCode, type CodeExtension } from 'prosekit/extensions/code';
export { defineLink, type LinkExtension } from 'prosekit/extensions/link';

// ---------------------------------------------------------------------------
// This library's own marks
// ---------------------------------------------------------------------------

/** The `highlight` mark: a run of text marked for attention, rendered `<mark>`. */
export function defineHighlight() {
  return defineMarkSpec({
    name: 'highlight',
    parseDOM: [{ tag: 'mark' }],
    toDOM() {
      return ['mark', 0];
    },
  });
}

/**
 * The `subscript` mark, rendered `<sub>`.
 *
 * Excludes {@link defineSuperscript}'s mark: a run of text is one or the
 * other, never both, and ProseMirror enforces that at the model level rather
 * than leaving it to the toolbar.
 */
export function defineSubscript() {
  return defineMarkSpec({
    name: 'subscript',
    excludes: 'superscript',
    parseDOM: [{ tag: 'sub' }],
    toDOM() {
      return ['sub', 0];
    },
  });
}

/** The `superscript` mark, rendered `<sup>`; excludes `subscript` — see {@link defineSubscript}. */
export function defineSuperscript() {
  return defineMarkSpec({
    name: 'superscript',
    excludes: 'subscript',
    parseDOM: [{ tag: 'sup' }],
    toDOM() {
      return ['sup', 0];
    },
  });
}

// ---------------------------------------------------------------------------
// Opt-in marks
// ---------------------------------------------------------------------------

/**
 * An inline mark binding a run of text to a cited work by id, rendered
 * `<cite data-work-id>`.
 *
 * A mark rather than a node, deliberately: marks carry no content, so a
 * citation annotates a run of prose and can never swallow structure the way a
 * footnote node could. `workId` is a caller-owned handle and is emitted as a
 * data attribute, never as a URL.
 *
 * Opt-in: not part of {@link defineStandardMarks}, because adding it changes
 * what the derived wire schema accepts.
 */
export function defineCitation() {
  return defineMarkSpec({
    name: 'citation',
    attrs: {
      workId: { default: '' },
    },
    parseDOM: [
      {
        tag: 'cite[data-work-id]',
        getAttrs: (dom) => ({ workId: dom.getAttribute('data-work-id') ?? '' }),
      },
    ],
    toDOM(mark) {
      // ProseMirror types `attrs` loosely; `workId` has a string default and
      // `parseDOM` only ever yields a string, so the fallback is unreachable.
      const workId = Option.getOrElse(
        Option.liftPredicate(mark.attrs.workId, P.isString),
        () => '',
      );
      return ['cite', { 'data-work-id': workId }, 0];
    },
  });
}

// ---------------------------------------------------------------------------
// The standard set
// ---------------------------------------------------------------------------

/**
 * The nine marks both presets in `./presets.ts` compose: ProseKit's `bold`,
 * `italic`, `underline`, `strike`, `code` and `link`, plus this library's
 * `highlight`, `subscript` and `superscript`.
 *
 * `citation` is not in the set — it is opt-in, and an application that wants
 * it passes `defineCitation()` as an extra to the preset.
 */
export function defineStandardMarks() {
  return union(
    defineBold(),
    defineItalic(),
    defineUnderline(),
    defineStrike(),
    defineCode(),
    defineLink(),
    defineHighlight(),
    defineSubscript(),
    defineSuperscript(),
  );
}
