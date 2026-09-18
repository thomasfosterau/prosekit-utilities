/**
 * Behavioural tests for the server-renderable flowchart SVG synthesiser
 * (`../../src/lib/node/svg.ts`) — the read-only fallback a consuming app's
 * HTML renderer injects so readers see a diagram without loading the
 * `@xyflow/svelte` runtime.
 *
 * Pins the structurally-faithful output: an accessible empty-state
 * placeholder, a node `<rect>` + label `<text>` per node, an edge `<path>`
 * with an arrow marker between connected nodes, the viewBox derived from
 * persisted node positions, the "Untitled" fallback for a blank label, that
 * an edge referring to a missing endpoint is dropped, that XML-sensitive
 * characters in a label are escaped, and that the three labels are
 * overridable. WHY: this markup is emitted verbatim into rendered prose, so
 * an unescaped label would be an XSS vector and a malformed viewBox would
 * break every diagram render.
 *
 * Ported from Website's `tests/flowchart-svg.test.ts` (7 cases), plus the
 * `labels` override this package adds.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import { generateFlowchartSvg } from '../../src/lib/node/svg.ts';
import type { FlowchartData } from '../../src/lib/node/schema.ts';

describe('generateFlowchartSvg', () => {
  it('renders an accessible placeholder for an empty payload', () => {
    const svg = generateFlowchartSvg({ nodes: [], edges: [] });
    expect(svg).toContain('<svg');
    expect(svg).toContain('aria-label="Empty flowchart"');
    expect(svg).toContain('>Empty flowchart<');
    // The empty state uses a fixed placeholder viewBox, not a computed one.
    expect(svg).toContain('viewBox="0 0 240 60"');
  });

  it('renders a node as a <rect> plus its label as <text>', () => {
    const data: FlowchartData = {
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'Start' } }],
      edges: [],
    };
    const svg = generateFlowchartSvg(data);
    expect(svg).toContain('<rect');
    expect(svg).toContain('>Start<');
    expect(svg).toContain('aria-label="Flowchart diagram with 1 node(s)"');
    expect(svg).toContain('translate(0,0)');
  });

  it("falls back to 'Untitled' for a blank label", () => {
    const data: FlowchartData = {
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: '' } }],
      edges: [],
    };
    expect(generateFlowchartSvg(data)).toContain('>Untitled<');
  });

  it('draws an edge path with the arrow marker between two connected nodes', () => {
    const data: FlowchartData = {
      nodes: [
        { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
        { id: 'b', position: { x: 200, y: 100 }, data: { label: 'B' } },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    };
    const svg = generateFlowchartSvg(data);
    expect(svg).toContain('<defs>');
    expect(svg).toContain('id="flowchart-arrow"');
    expect(svg).toContain('<path');
    expect(svg).toContain('marker-end="url(#flowchart-arrow)"');
    // Two node boxes are rendered.
    expect(svg.match(/<rect/g)).toHaveLength(2);
  });

  it('drops an edge whose source or target node is missing', () => {
    const data: FlowchartData = {
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } }],
      edges: [{ id: 'dangling', source: 'a', target: 'ghost' }],
    };
    const svg = generateFlowchartSvg(data);
    // No edge path is drawn (the dangling edge resolves to null and is filtered).
    // The only `<path>` present is the arrow-marker definition inside <defs>.
    expect(svg).not.toContain('marker-end="url(#flowchart-arrow)"');
    expect(svg.match(/<path/g)).toHaveLength(1);
  });

  it('derives the viewBox from persisted node positions with padding', () => {
    const data: FlowchartData = {
      nodes: [{ id: 'a', position: { x: 50, y: 60 }, data: { label: 'X' } }],
      edges: [],
    };
    const svg = generateFlowchartSvg(data);
    // CANVAS_PADDING is 20, so minX = 50 - 20 = 30, minY = 60 - 20 = 40.
    expect(svg).toMatch(/viewBox="30 40 \d/);
  });

  it('escapes XML-sensitive characters in a node label', () => {
    const data: FlowchartData = {
      nodes: [
        {
          id: 'x',
          position: { x: 0, y: 0 },
          data: { label: `<script>&"'` },
        },
      ],
      edges: [],
    };
    const svg = generateFlowchartSvg(data);
    expect(svg).not.toMatch(/<script>/);
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;');
    expect(svg).toContain('&apos;');
  });

  describe('overridable labels', () => {
    const data: FlowchartData = {
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: { label: '' } }],
      edges: [],
    };

    it('uses a custom empty-state label', () => {
      const svg = generateFlowchartSvg({ nodes: [], edges: [] }, { emptyLabel: 'Nothing here' });
      expect(svg).toContain('aria-label="Nothing here"');
      expect(svg).toContain('>Nothing here<');
      expect(svg).not.toContain('Empty flowchart');
    });

    it('uses a custom diagram-label function, given the node count', () => {
      const svg = generateFlowchartSvg(data, { diagramLabel: (n) => `${n} step(s)` });
      expect(svg).toContain('aria-label="1 step(s)"');
    });

    it('uses a custom untitled-node label', () => {
      const svg = generateFlowchartSvg(data, { untitledLabel: 'Unnamed step' });
      expect(svg).toContain('>Unnamed step<');
    });
  });
});
