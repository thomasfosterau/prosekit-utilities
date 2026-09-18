/**
 * Behavioural tests for the flowchart ProseKit node spec and command
 * (`../../src/lib/node/flowchart-node.ts`).
 *
 * Pins the registered node's shape (an isolating block atom), the
 * unicode-escaped `data-payload` `toDOM` emits, the empty-payload fallback
 * when `data` is absent, `updateFlowchartData`'s mutate-in-place behaviour on
 * a mounted editor (and its no-op guard on a non-flowchart position), and the
 * `parseDOM.getAttrs` round-trip — `data-payload` first, `textContent`
 * fallback for legacy documents, empty payload for unparseable content.
 *
 * Runs in Vitest browser mode (real Chromium, per this package's
 * `vite.config.ts`), so a mounted ProseMirror `EditorView` is available
 * without a `happy-dom` pragma — unlike Website's node-Vitest suite, which
 * needed one for exactly this reason.
 *
 * Ported from the `describe("defineFlowchart", ...)` block of Website's
 * `tests/editor-extensions.test.ts` and the
 * `describe("flowchart parseDOM.getAttrs (DOM round-trip)", ...)` block of
 * `tests/editor-html-browser.test.ts`.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import { createEditor, union } from 'prosekit/core';
import { defineDoc } from 'prosekit/extensions/doc';
import { defineParagraph } from 'prosekit/extensions/paragraph';
import { defineText } from 'prosekit/extensions/text';
import { EMPTY_FLOWCHART } from '../../src/lib/node/data.ts';
import { defineFlowchart } from '../../src/lib/node/flowchart-node.ts';

const extension = () => union(defineDoc(), defineText(), defineParagraph(), defineFlowchart());

describe('defineFlowchart', () => {
  const editor = createEditor({ extension: extension() });

  it('registers the flowchart node as an isolating block atom', () => {
    const spec = editor.schema.nodes.flowchart!.spec;
    expect(spec.atom).toBe(true);
    expect(spec.isolating).toBe(true);
    expect(spec.group).toContain('block');
  });

  it('emits a `data-flowchart` div whose `data-payload` JSON is unicode-escaped', () => {
    // A label with HTML-sensitive characters must be unicode-escaped in the
    // attribute value so it can't break out of the attribute context.
    const data = {
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: '<x>&\'"' } }],
      edges: [],
    };
    const node = editor.schema.nodes.flowchart!.create({ data });
    const dom = editor.schema.nodes.flowchart!.spec.toDOM!(node) as [
      string,
      Record<string, string>,
      string,
    ];
    expect(dom[0]).toBe('div');
    expect(dom[1]['data-flowchart']).toBe('');
    const payload = dom[1]['data-payload']!;
    expect(payload).not.toContain('<');
    expect(payload).not.toContain('>');
    expect(payload).not.toContain('&');
    expect(payload).not.toContain("'");
    expect(payload).toContain('\\u003c');
    expect(payload).toContain('\\u003e');
    expect(payload).toContain('\\u0026');
    expect(payload).toContain('\\u0027');
    // A double quote stays JSON-escaped (it is safe inside a single-quoted
    // attribute and the serializer can choose its own quoting).
    expect(payload).toContain('\\"');
  });

  it('falls back to the empty payload when `data` is absent', () => {
    const node = editor.schema.nodes.flowchart!.create();
    const dom = editor.schema.nodes.flowchart!.spec.toDOM!(node) as [
      string,
      Record<string, string>,
      string,
    ];
    expect(dom[1]['data-payload']).toBe(JSON.stringify(EMPTY_FLOWCHART));
  });

  it("updateFlowchartData mutates a mounted flowchart node's data in place", () => {
    const mounted = createEditor({ extension: extension() });
    const { schema } = mounted;
    const flowNode = schema.nodes.flowchart!.create({ data: EMPTY_FLOWCHART });
    mounted.setContent(schema.nodes.doc!.create(null, flowNode));
    const place = document.createElement('div');
    mounted.mount(place);
    try {
      const newData = {
        nodes: [{ id: 'n', position: { x: 1, y: 2 }, data: { label: 'L' } }],
        edges: [],
      };
      expect(mounted.commands.updateFlowchartData(0, newData)).toBe(true);
      expect(mounted.view.state.doc.nodeAt(0)!.attrs.data).toEqual(newData);
    } finally {
      mounted.unmount();
    }
  });

  it('updateFlowchartData is a no-op when the target position is not a flowchart', () => {
    const mounted = createEditor({ extension: extension() });
    const { schema } = mounted;
    const paragraph = schema.nodes.paragraph!.create(null, schema.text('hi'));
    mounted.setContent(schema.nodes.doc!.create(null, paragraph));
    const place = document.createElement('div');
    mounted.mount(place);
    try {
      expect(mounted.commands.updateFlowchartData(0, EMPTY_FLOWCHART)).toBe(false);
    } finally {
      mounted.unmount();
    }
  });

  it('defineFlowchart() returns an extension object', () => {
    expect(defineFlowchart()).toBeTruthy();
  });
});

describe('flowchart parseDOM.getAttrs (DOM round-trip)', () => {
  const editor = createEditor({ extension: extension() });

  it('reads the diagram payload from the `data-payload` attribute', () => {
    const data = {
      nodes: [{ id: 'a', position: { x: 1, y: 2 }, data: { label: 'L' } }],
      edges: [],
    };
    const payload = JSON.stringify(data);
    editor.setContent(`<div data-flowchart data-payload='${payload}'></div>`);
    const json = editor.getDocJSON() as {
      content?: Array<{ type: string; attrs?: { data?: unknown } }>;
    };
    const flow = json.content?.find((n) => n.type === 'flowchart');
    expect(flow?.attrs?.data).toEqual(data);
  });

  it("falls back to the element's text content for legacy serialised payloads", () => {
    const data = {
      nodes: [{ id: 'b', position: { x: 3, y: 4 }, data: { label: 'Legacy' } }],
      edges: [],
    };
    // Older documents carried the JSON inside the element, not in data-payload.
    editor.setContent(`<div data-flowchart>${JSON.stringify(data)}</div>`);
    const json = editor.getDocJSON() as {
      content?: Array<{ type: string; attrs?: { data?: unknown } }>;
    };
    const flow = json.content?.find((n) => n.type === 'flowchart');
    expect(flow?.attrs?.data).toEqual(data);
  });

  it('falls back to the empty payload for an unparseable flowchart div', () => {
    editor.setContent(`<div data-flowchart>not json</div>`);
    const json = editor.getDocJSON() as {
      content?: Array<{ type: string; attrs?: { data?: unknown } }>;
    };
    const flow = json.content?.find((n) => n.type === 'flowchart');
    expect(flow?.attrs?.data).toEqual({ nodes: [], edges: [] });
  });
});
