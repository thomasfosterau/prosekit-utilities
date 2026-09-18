/**
 * Unit test for `defineFlowchartNodeView`.
 *
 * `defineSvelteNodeView` is mocked so the test captures the spec the factory
 * passes rather than constructing an editor: what matters for correctness is
 * the node name (`flowchart`), the `div` host element, and the two mutation
 * guards. Both return `true` so ProseMirror does not read the diagram's own
 * DOM rewrites — the SVG preview, and the canvas once the dialog is open — as
 * document edits.
 *
 * The Svelte component is stubbed too, so nothing here pulls in the dialog or
 * the `@xyflow/svelte` bundle.
 *
 * Ported from Website's `tests/flowchart-node-view.test.ts`.
 *
 * @module
 */

import { describe, expect, it, vi } from 'vite-plus/test';

const { defineSvelteNodeView } = vi.hoisted(() => ({
  defineSvelteNodeView: vi.fn((spec: unknown) => ({ __spec: spec })),
}));
vi.mock('prosekit/svelte', () => ({ defineSvelteNodeView }));
vi.mock('../src/lib/FlowchartNodeView.svelte', () => ({ default: {} }));

const { defineFlowchartNodeView } = await import('../src/lib/flowchart-node-view.ts');

interface NodeViewSpec {
  name: string;
  as: string;
  ignoreMutation: () => boolean;
  stopEvent: () => boolean;
}

describe('defineFlowchartNodeView', () => {
  it("registers a 'flowchart' node view hosted in a div", () => {
    defineSvelteNodeView.mockClear();

    defineFlowchartNodeView();

    expect(defineSvelteNodeView).toHaveBeenCalledTimes(1);
    const spec = defineSvelteNodeView.mock.calls[0]?.[0] as NodeViewSpec;
    expect(spec.name).toBe('flowchart');
    expect(spec.as).toBe('div');
  });

  it('ignores mutations and stops events so the diagram is inert to ProseMirror', () => {
    defineFlowchartNodeView();

    const spec = defineSvelteNodeView.mock.calls.at(-1)?.[0] as NodeViewSpec;
    expect(spec.ignoreMutation()).toBe(true);
    expect(spec.stopEvent()).toBe(true);
  });
});
