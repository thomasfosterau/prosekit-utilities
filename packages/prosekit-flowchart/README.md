# @thomasfosterau/prosekit-flowchart

A flowchart block for [ProseKit](https://prosekit.dev) documents, in two entry points. `./node` is the canvas-free half (node spec, [Effect Schema](https://effect.website) payload, server-renderable SVG, HTML and Markdown hooks) and imports neither Svelte nor `@xyflow/svelte`. The root is the `@xyflow/svelte` canvas, edit dialog, node view and toolbar entries.

## Installation

```sh
pnpm add @thomasfosterau/prosekit-flowchart @xyflow/svelte
```

| Package | Range | Why |
| --- | --- | --- |
| `@xyflow/svelte` | `^1.6.6`, **required** | The canvas engine. Reached from one module (`Flowchart.svelte`), which the edit dialog loads dynamically on first open. |
| `svelte` | `^5.30.1` | The components are compiled by your build. |
| `prosekit` | `^0.23.0` | `defineFlowchart()` and `defineFlowchartNodeView()` are ProseKit extensions. |
| `@prosekit/pm` | `^0.1.21` | The node view's `Node` / `Attrs` types. |
| `effect` | `^4.0.0` | The payload schemas under `./node`. The root entry imports no Effect itself. |

`@thomasfosterau/prosekit-utilities`, `@thomasfosterau/prosekit-svelte` and `bits-ui` are ordinary dependencies and come along automatically. Tailwind and daisyUI are required too, and Tailwind must scan this package's `dist/` ([setup](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/flowchart.md#tailwind-and-daisyui)).

## Example

```ts
import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
import { defineFlowchart } from '@thomasfosterau/prosekit-flowchart/node';

// The schema half; safe on a server. The UI half is `defineFlowchartNodeView()` from the root.
export const extension = defineBlockDocumentExtension(defineFlowchart());
```

## Entry points

| Entry | Main exports |
| --- | --- |
| `./node` | `defineFlowchart`, `FlowchartData`, `parseFlowchartData`, `generateFlowchartSvg`, `FLOWCHART_ATTRIBUTE_OVERRIDES`, `postProcessFlowcharts`, `flowchartMarkdown` |
| `.` | `Flowchart`, `FlowchartEditDialog`, `FlowchartNodeView`, `EditableNode`, `defineFlowchartNodeView`, `flowchartToolbarItem`, `flowchartSlashCommand` |

## Links

- [Flowchart guide](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/flowchart.md): wiring the block into an editor, the canvas and node view
- [CHANGELOG](CHANGELOG.md), [CONTRIBUTING](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/CONTRIBUTING.md), [AGENTS.md](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/AGENTS.md), [PUBLISHING](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/PUBLISHING.md), [SECURITY](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/SECURITY.md)
