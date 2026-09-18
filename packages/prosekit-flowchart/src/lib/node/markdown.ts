/**
 * Markdown placeholder for the flowchart block.
 *
 * Markdown has no diagram syntax, so a flowchart node renders as a fixed,
 * overridable label rather than being silently dropped — the Markdown stays
 * a truthful reflection of what the HTML renders.
 *
 * A factory rather than a constant (unlike `@thomasfosterau/prosekit-utilities`'s
 * other opt-in serialisers, `mentionMarkdown` / `figureMarkdown` /
 * `sidenoteMarkdown`) so a consuming app can change the label without
 * re-implementing the `BlockSerialiser`:
 *
 * ```ts
 * const toMarkdown = createMarkdownSerialiser({
 *   blocks: { flowchart: flowchartMarkdown('_[diagram omitted]_') },
 * });
 * ```
 *
 * Ported verbatim from the `case "flowchart": return "_[flowchart
 * diagram]_";` branch of Website's `src/editor/markdown.ts`.
 *
 * @module @thomasfosterau/prosekit-flowchart/node/markdown
 */

import type { BlockSerialiser } from '@thomasfosterau/prosekit-utilities';

/** Website's own copy, and this factory's default `label`. */
const DEFAULT_LABEL = '_[flowchart diagram]_';

/**
 * Builds a {@link BlockSerialiser} that renders every flowchart node as
 * `label`, ignoring the node's own content — there is nothing in a
 * {@link import("./schema.ts").FlowchartData} payload with a faithful
 * Markdown form.
 */
export function flowchartMarkdown(label: string = DEFAULT_LABEL): BlockSerialiser {
  return () => label;
}
