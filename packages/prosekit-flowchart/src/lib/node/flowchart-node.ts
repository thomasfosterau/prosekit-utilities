/**
 * Flowchart block node for the ProseKit editor.
 *
 * Stores the diagram payload as a single `data` attribute containing a
 * {@link FlowchartData}. The DOM representation is
 * `<div data-flowchart>{JSON}</div>` so SSR and paste both round-trip the
 * data through textContent.
 *
 * Ported verbatim from Website's `src/editor/flowchart/flowchart-node.ts`.
 * The Svelte-backed node view lives at the flowchart package's root; this
 * module only registers the schema-side node spec and the editing command.
 *
 * @module @thomasfosterau/prosekit-flowchart/node/flowchart-node
 */

import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { defineCommands, defineNodeSpec, union } from 'prosekit/core';
import { EMPTY_FLOWCHART, parseFlowchartData } from './data.ts';
import type { FlowchartData } from './schema.ts';

/**
 * JSON encoder for the `data` attr payload. Built once at module scope —
 * `toDOM` runs per flowchart node on every editor render.
 */
const encodeJson = /* @__PURE__ */ Schema.encodeSync(
  /* @__PURE__ */ Schema.fromJsonString(Schema.Unknown),
);

/**
 * JSON encoding with HTML-sensitive characters unicode-escaped so the result
 * can be embedded in an HTML attribute value without breaking out, regardless
 * of which quote the serializer chooses.
 */
function htmlSafeStringify(value: unknown): string {
  return encodeJson(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027');
}

function defineFlowchartNodeSpec() {
  return defineNodeSpec({
    name: 'flowchart',
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,
    isolating: true,
    attrs: {
      data: { default: EMPTY_FLOWCHART },
    },
    parseDOM: [
      {
        tag: 'div[data-flowchart]',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          // Prefer the `data-payload` attribute (current emit format). Fall
          // back to text content for older serialised documents where the
          // JSON lived inside the element.
          const payload = el.getAttribute('data-payload') ?? el.textContent ?? '';
          return { data: parseFlowchartData(payload) };
        },
      },
    ],
    toDOM: (node) => {
      // ProseMirror `attrs` is a foreign plain object; convert at the
      // boundary rather than pushing `Option` into the node spec.
      const raw = Option.fromNullishOr((node.attrs as { data?: unknown }).data);
      const data = Option.isNone(raw) ? EMPTY_FLOWCHART : (raw.value as FlowchartData);
      // Persist the JSON in an attribute so the element's inner content is
      // free for the post-rendered SVG (see `./html.ts`). The JSON is
      // unicode-escaped so user-supplied labels containing `<`, `>`, `&`, `'`
      // can never break out of the attribute context. The empty text child
      // ensures happy-dom emits a proper closing tag.
      return ['div', { 'data-flowchart': '', 'data-payload': htmlSafeStringify(data) }, ''];
    },
  });
}

function defineFlowchartCommands() {
  return defineCommands({
    updateFlowchartData: (pos: number, data: FlowchartData) => (state, dispatch) => {
      const node = state.doc.nodeAt(pos);
      if (!node || node.type.name !== 'flowchart') return false;
      if (dispatch) {
        const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, data });
        dispatch(tr);
      }
      return true;
    },
  });
}

/**
 * Schema-side extension for the flowchart block: registers the node spec and
 * the `updateFlowchartData` editing command. The Svelte-backed node view
 * lives at this package's root and is composed in by the consuming app's
 * editor component at instantiation time.
 */
export function defineFlowchart() {
  return union(defineFlowchartNodeSpec(), defineFlowchartCommands());
}
