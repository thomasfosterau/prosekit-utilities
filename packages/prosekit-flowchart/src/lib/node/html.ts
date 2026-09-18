/**
 * Flowchart post-processing pass for a ProseKit HTML renderer.
 *
 * `@thomasfosterau/prosekit-utilities/prosekit`'s `createHtmlRenderer` (and
 * ProseKit's own `toDOM`) render a flowchart node as an inert
 * `<div data-flowchart data-payload="…">` placeholder — the node spec has no
 * way to synthesise the SVG itself, since `toDOM` runs with no access to
 * `generateFlowchartSvg`. A consuming app wires this in as that renderer's
 * `postProcess` hook so the placeholder becomes a real diagram in the served
 * HTML:
 *
 * ```ts
 * createHtmlRenderer({ postProcess: postProcessFlowcharts });
 * ```
 *
 * Ported verbatim from Website's `postProcessFlowcharts` in
 * `src/editor/html.ts`.
 *
 * @module @thomasfosterau/prosekit-flowchart/node/html
 */

import * as Array from 'effect/Array';
import { parseFlowchartData } from './data.ts';
import { generateFlowchartSvg } from './svg.ts';

/**
 * Replaces the inner content of every `[data-flowchart]` placeholder with a
 * server-rendered SVG snapshot derived from the placeholder's `data-payload`
 * JSON attribute. The `data-payload` attribute stays on the element so the
 * editor can still round-trip the diagram via {@link parseFlowchartData}.
 *
 * `document` is the caller's DOM implementation (the browser's global, or a
 * server-side one such as linkedom) — this module never constructs one
 * itself, keeping it usable from both a browser bundle and a Worker.
 */
export function postProcessFlowcharts(html: string, document: Document): string {
  if (!html.includes('data-flowchart')) return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  const placeholders = Array.fromIterable(container.querySelectorAll('[data-flowchart]'));
  placeholders.forEach((placeholder) => {
    const payload = placeholder.getAttribute('data-payload') ?? '';
    const data = parseFlowchartData(payload);
    placeholder.innerHTML = generateFlowchartSvg(data);
  });
  return container.innerHTML;
}
