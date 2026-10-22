/**
 * Behavioural tests for the flowchart HTML post-processing hook
 * (`../../src/lib/node/html.ts`).
 *
 * `postProcessFlowcharts` is the `postProcess` hook a consuming app wires
 * into `@thomasfosterau/prosekit-utilities/prosekit`'s `createHtmlRenderer`;
 * here it is exercised directly against the global `document` browser mode
 * already provides, standing in for that caller.
 *
 * Ported from the flowchart assertions inside the
 * `describe("generateBlockDocumentHTML (browser path)", ...)` block of
 * Website's `tests/editor-html-browser.test.ts`, narrowed to this function's
 * own contract (it no longer goes through the full document renderer).
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import * as Schema from 'effect/Schema';
import { postProcessFlowcharts } from '../../src/lib/node/html.ts';

const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

describe('postProcessFlowcharts', () => {
  it('replaces a `[data-flowchart]` placeholder with an inline SVG snapshot, keeping data-payload', () => {
    const data = {
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'Start' } }],
      edges: [],
    };
    const payload = toJson(data);
    const html = `<div data-flowchart data-payload="${payload.replace(/"/g, '&quot;')}"></div>`;
    const result = postProcessFlowcharts(html, document);
    expect(result).toContain('data-flowchart');
    expect(result).toContain('data-payload');
    expect(result).toContain('<svg');
    expect(result).toContain('>Start<');
  });

  it('returns the input unchanged when there is no flowchart placeholder', () => {
    const html = '<p>no diagrams here</p>';
    expect(postProcessFlowcharts(html, document)).toBe(html);
  });

  it('falls back to the empty-flowchart SVG for an unparseable payload', () => {
    const html = '<div data-flowchart data-payload="not json"></div>';
    const result = postProcessFlowcharts(html, document);
    expect(result).toContain('aria-label="Empty flowchart"');
  });

  it('post-processes multiple placeholders in one pass', () => {
    const one = toJson({
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'One' } }],
      edges: [],
    }).replace(/"/g, '&quot;');
    const two = toJson({
      nodes: [{ id: 'b', position: { x: 0, y: 0 }, data: { label: 'Two' } }],
      edges: [],
    }).replace(/"/g, '&quot;');
    const html =
      `<div data-flowchart data-payload="${one}"></div>` +
      `<div data-flowchart data-payload="${two}"></div>`;
    const result = postProcessFlowcharts(html, document);
    expect(result).toContain('>One<');
    expect(result).toContain('>Two<');
    expect(result.match(/<svg/g)).toHaveLength(2);
  });
});
