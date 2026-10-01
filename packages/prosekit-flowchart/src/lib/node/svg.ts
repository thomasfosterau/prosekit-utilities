/**
 * Server-renderable SVG synthesis for flowchart blocks.
 *
 * Walks a {@link FlowchartData} payload and emits a self-contained SVG markup
 * string — no DOM measurement required, since node positions are already
 * persisted. This is the read-only fallback a consuming app's HTML renderer
 * injects (via `postProcessFlowcharts`, `./html.ts`) so readers see the
 * diagram without loading this package's canvas runtime.
 *
 * Output is not pixel-perfect with the interactive canvas (font metrics and
 * edge curves are approximated) but is structurally faithful and cheap to
 * generate in a Worker.
 *
 * Ported verbatim from Website's `src/editor/flowchart/svg.ts`, with the
 * three user-facing strings (the empty-state label, the diagram's
 * node-count summary, the untitled-node fallback) promoted to an optional
 * `labels` parameter — each still defaults to Website's own copy.
 *
 * @module @thomasfosterau/prosekit-flowchart/node/svg
 */

import * as Array from 'effect/Array';
import * as HashMap from 'effect/HashMap';
import * as Option from 'effect/Option';
import type { FlowchartData, FlowchartEdge, FlowchartNode } from './schema.ts';

/** Minimum width of a rendered node box, in canvas units. */
const MIN_NODE_WIDTH = 100;

/** Fixed height of a rendered node box (single-line label). */
const NODE_HEIGHT = 40;

/** Horizontal padding inside the node box. */
const NODE_PADDING_X = 16;

/** Approximate advance width per character at the rendered font size. */
const CHAR_WIDTH = 7.2;

/** Padding around the rendered diagram inside the SVG viewBox. */
const CANVAS_PADDING = 20;

/** Default for `labels.emptyLabel`. */
const DEFAULT_EMPTY_LABEL = 'Empty flowchart';

/** Default for `labels.diagramLabel`. */
const defaultDiagramLabel = (nodeCount: number): string =>
  `Flowchart diagram with ${nodeCount} node(s)`;

/** Default for `labels.untitledLabel`. */
const DEFAULT_UNTITLED_LABEL = 'Untitled';

// The defaults are the source application's own text, so an omitted `labels`
// argument reproduces its output exactly.
/**
 * Overridable copy for {@link generateFlowchartSvg}'s accessible strings;
 * each field documents its English default.
 */
export interface FlowchartSvgLabels {
  /** The empty-state `<svg>`'s `aria-label` and visible text. Default: `'Empty flowchart'`. */
  readonly emptyLabel?: string | undefined;
  /** The populated diagram's `aria-label`, given the node count. Default: `Flowchart diagram with ${n} node(s)`. */
  readonly diagramLabel?: ((nodeCount: number) => string) | undefined;
  /** Fallback text for a node whose label is blank. Default: `'Untitled'`. */
  readonly untitledLabel?: string | undefined;
}

interface SizedNode extends FlowchartNode {
  width: number;
  height: number;
}

function sizeNode(node: FlowchartNode): SizedNode {
  const label = node.data.label;
  const width = Math.max(MIN_NODE_WIDTH, label.length * CHAR_WIDTH + NODE_PADDING_X * 2);
  return { ...node, width, height: NODE_HEIGHT };
}

/**
 * Returns an SVG markup string for the given flowchart payload.
 *
 * The SVG uses `currentColor` for strokes and text so it adapts to the
 * surrounding theme. Width is constrained to the container via `width="100%"`;
 * height is derived from the viewBox aspect ratio.
 */
export function generateFlowchartSvg(data: FlowchartData, labels?: FlowchartSvgLabels): string {
  const emptyLabel = labels?.emptyLabel ?? DEFAULT_EMPTY_LABEL;
  const diagramLabel = labels?.diagramLabel ?? defaultDiagramLabel;
  const untitledLabel = labels?.untitledLabel ?? DEFAULT_UNTITLED_LABEL;

  const sized = data.nodes.map(sizeNode);

  if (Array.isArrayEmpty(sized)) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" width="100%" ` +
      `role="img" aria-label="${escapeXml(emptyLabel)}">` +
      `<text x="120" y="30" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="currentColor" ` +
      `opacity="0.6">${escapeXml(emptyLabel)}</text>` +
      `</svg>`
    );
  }

  const minX = Math.min(...sized.map((n) => n.position.x)) - CANVAS_PADDING;
  const minY = Math.min(...sized.map((n) => n.position.y)) - CANVAS_PADDING;
  const maxX = Math.max(...sized.map((n) => n.position.x + n.width)) + CANVAS_PADDING;
  const maxY = Math.max(...sized.map((n) => n.position.y + n.height)) + CANVAS_PADDING;
  const width = maxX - minX;
  const height = maxY - minY;

  const byId = HashMap.fromIterable(sized.map((n) => [n.id, n] as const));

  const defs =
    `<defs>` +
    `<marker id="flowchart-arrow" viewBox="0 0 10 10" refX="9" refY="5" ` +
    `markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />` +
    `</marker>` +
    `</defs>`;

  const edgePaths = Array.getSomes(data.edges.map((edge) => renderEdge(edge, byId))).join('');

  const nodeRects = sized.map((node) => renderNode(node, untitledLabel)).join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${minX} ${minY} ${width} ${height}" ` +
    `width="100%" preserveAspectRatio="xMidYMid meet" ` +
    `role="img" aria-label="${escapeXml(diagramLabel(sized.length))}">` +
    defs +
    edgePaths +
    nodeRects +
    `</svg>`
  );
}

function renderNode(node: SizedNode, untitledLabel: string): string {
  const { position, width, height, data } = node;
  return (
    `<g transform="translate(${position.x},${position.y})">` +
    `<rect width="${width}" height="${height}" rx="4" ry="4" ` +
    `fill="transparent" stroke="currentColor" stroke-width="1" />` +
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" ` +
    `dominant-baseline="central" font-family="ui-sans-serif, system-ui, sans-serif" ` +
    `font-size="12" fill="currentColor">${escapeXml(data.label || untitledLabel)}</text>` +
    `</g>`
  );
}

function renderEdge(
  edge: FlowchartEdge,
  nodes: HashMap.HashMap<string, SizedNode>,
): Option.Option<string> {
  const sourceOption = HashMap.get(nodes, edge.source);
  const targetOption = HashMap.get(nodes, edge.target);
  if (Option.isNone(sourceOption) || Option.isNone(targetOption)) return Option.none();
  const source = sourceOption.value;
  const target = targetOption.value;
  // Source handle at bottom-center; target handle at top-center. Approximates
  // Svelte Flow's default bezier edge with vertical handles.
  const x1 = source.position.x + source.width / 2;
  const y1 = source.position.y + source.height;
  const x2 = target.position.x + target.width / 2;
  const y2 = target.position.y;
  const cyMid = (y1 + y2) / 2;
  const path = `M ${x1},${y1} C ${x1},${cyMid} ${x2},${cyMid} ${x2},${y2}`;
  return Option.some(
    `<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" ` +
      `marker-end="url(#flowchart-arrow)" />`,
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
