/**
 * Behavioural tests for the flowchart payload parser
 * (`../../src/lib/node/data.ts`).
 *
 * Pins the previous hand-guard behaviour it replaced: a well-formed payload
 * round-trips exactly, invalid JSON and non-object JSON both fall back to
 * {@link EMPTY_FLOWCHART}, missing or non-array `nodes`/`edges` default to
 * empty arrays, and an individually malformed node or edge is dropped rather
 * than failing the whole array.
 *
 * Ported from the `describe("parseFlowchartData", ...)` block of Website's
 * `tests/editor-extensions.test.ts`.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import { EMPTY_FLOWCHART, parseFlowchartData } from '../../src/lib/node/data.ts';

describe('parseFlowchartData', () => {
  it('parses a well-formed payload, keeping valid nodes and edges', () => {
    const json = JSON.stringify({
      nodes: [{ id: 'a', position: { x: 1, y: 2 }, data: { label: 'A' } }],
      edges: [{ id: 'e', source: 'a', target: 'b' }],
    });
    expect(parseFlowchartData(json)).toEqual({
      nodes: [{ id: 'a', position: { x: 1, y: 2 }, data: { label: 'A' } }],
      edges: [{ id: 'e', source: 'a', target: 'b' }],
    });
  });

  it('returns the empty payload for invalid JSON', () => {
    expect(parseFlowchartData('not json {')).toEqual(EMPTY_FLOWCHART);
  });

  it('returns the empty payload for a non-object JSON value', () => {
    expect(parseFlowchartData('42')).toEqual(EMPTY_FLOWCHART);
    expect(parseFlowchartData('null')).toEqual(EMPTY_FLOWCHART);
  });

  it('defaults missing or non-array nodes/edges to empty arrays', () => {
    expect(parseFlowchartData(JSON.stringify({}))).toEqual({ nodes: [], edges: [] });
    expect(parseFlowchartData(JSON.stringify({ nodes: 'x', edges: 3 }))).toEqual({
      nodes: [],
      edges: [],
    });
  });

  it('drops malformed nodes (bad id / position / data)', () => {
    const json = JSON.stringify({
      nodes: [
        { id: 1, position: { x: 0, y: 0 }, data: { label: 'bad id' } },
        { id: 'ok', position: { x: 0, y: 'no' }, data: { label: 'bad y' } },
        { id: 'ok2', position: { x: 0, y: 0 }, data: { label: 5 } },
        { id: 'ok3', position: { x: 0, y: 0 }, data: { label: 'good' } },
        { id: 'ok4', data: { label: 'no position' } },
        null,
      ],
      edges: [],
    });
    expect(parseFlowchartData(json).nodes).toEqual([
      { id: 'ok3', position: { x: 0, y: 0 }, data: { label: 'good' } },
    ]);
  });

  it('drops malformed edges (missing source / target / id)', () => {
    const json = JSON.stringify({
      nodes: [],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a' },
        { source: 'a', target: 'b' },
        'string',
      ],
    });
    expect(parseFlowchartData(json).edges).toEqual([{ id: 'e1', source: 'a', target: 'b' }]);
  });

  it('returns a fresh empty payload each time (not a shared reference)', () => {
    const a = parseFlowchartData('not json');
    const b = parseFlowchartData('not json');
    expect(a).toEqual(EMPTY_FLOWCHART);
    expect(a).not.toBe(b);
  });
});
