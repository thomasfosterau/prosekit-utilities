/**
 * `@thomasfosterau/prosekit-flowchart/node` — the flowchart block without a
 * canvas: the ProseKit node spec and command, the Effect Schema payload, the
 * server-renderable SVG, the attribute-overlay entry and the HTML / Markdown
 * serialiser hooks. Safe on a server and in a bundle that never renders the
 * canvas.
 *
 * @module
 */

export { EMPTY_FLOWCHART, parseFlowchartData, type FlowchartPosition } from './data.ts';
export { defineFlowchart } from './flowchart-node.ts';
export { postProcessFlowcharts } from './html.ts';
export { flowchartMarkdown } from './markdown.ts';
export { FLOWCHART_ATTRIBUTE_OVERRIDES } from './overrides.ts';
export { FlowchartData, FlowchartEdge, FlowchartNode } from './schema.ts';
export { generateFlowchartSvg, type FlowchartSvgLabels } from './svg.ts';
