# @thomasfosterau/prosekit-flowchart

A flowchart block for [ProseKit](https://prosekit.dev) documents, in two entry points. `./node` is the canvas-free half — the ProseMirror node spec and its `updateFlowchartData` command, the [Effect Schema](https://effect.website) payload, a server-renderable SVG, the attribute-override entry, and the HTML / Markdown serialiser hooks — and imports neither Svelte nor `@xyflow/svelte`, so it is safe on a server and in any bundle that never renders the interactive canvas. The root is the `@xyflow/svelte` canvas (`Flowchart`), the edit dialog, the editable node, the ProseKit Svelte node view, and the toolbar / insert-menu entries.

**Why it is its own package.** A component whose behaviour needs a specific third-party dependency lives in its own package adjacent to the editor package, so the editor package stays free of it. Here that dependency is `@xyflow/svelte` — installing this package is the decision to render a flowchart, it is this package's **required** peer, and `@thomasfosterau/prosekit-svelte` never mentions it.

## Installation

```sh
pnpm add @thomasfosterau/prosekit-flowchart @xyflow/svelte
```

### Peer requirements

| Package | Range | Why |
| --- | --- | --- |
| `@xyflow/svelte` | `^1.6.6`, **required** | The canvas engine, and this package's reason to exist as a package. Reached from exactly one module (`Flowchart.svelte`), which `FlowchartEditDialog` loads through a dynamic `import()` the first time it opens. |
| `svelte` | `^5.30.1` | The components are compiled by your build, not pre-compiled. |
| `prosekit` | `^0.22.2` | `defineFlowchart()` registers a node spec on a ProseKit extension; `defineFlowchartNodeView()` is one. |
| `@prosekit/pm` | `^0.1.19` | The node view's `Node` / `Attrs` types. |
| `effect` | `>=4.0.0-rc.118` | The payload schemas under `./node`. The root entry imports no Effect itself. |

`@thomasfosterau/prosekit-utilities` and `@thomasfosterau/prosekit-svelte` are not peers — they are ordinary dependencies of this package, at the same release line, and come along automatically when you install it. `bits-ui` does too, for `FlowchartEditDialog`'s `Dialog`.

Tailwind and daisyUI are not declared peers, but they are **required**: every component here emits daisyUI classes (`btn`, `modal-box`, `input`, `text-error`) and ships no CSS of its own. Add this package's `dist/` to Tailwind's sources, or its classes are never emitted:

```css
@import 'tailwindcss';
@source '../node_modules/@thomasfosterau/prosekit-svelte/dist';
@source '../node_modules/@thomasfosterau/prosekit-flowchart/dist';
@plugin "daisyui";
```

`@xyflow/svelte/dist/style.css` is imported by `Flowchart.svelte` for its side effect — you do not import it yourself, and it does not arrive on a page that never opens the edit dialog.

## Wiring the block into an editor

`./node` gives an application the grammar; the root gives it the UI. A worked example, threading both through one `blockDocument` surface:

```ts
// document-schema.ts — server-only: the grammar, and the derived wire schema
import {
  defineBlockDocumentExtension,
  defineDocumentSchema,
  mergeAttributeOverrides,
  STANDARD_ATTRIBUTE_OVERRIDES,
} from '@thomasfosterau/prosekit-utilities/prosekit';
import {
  defineFlowchart,
  FLOWCHART_ATTRIBUTE_OVERRIDES,
} from '@thomasfosterau/prosekit-flowchart/node';
import { blockDocument } from './document-shapes.ts';

export const blockDocumentSchema = defineDocumentSchema(blockDocument, {
  extension: () => defineBlockDocumentExtension(defineFlowchart()),
  attributes: mergeAttributeOverrides(STANDARD_ATTRIBUTE_OVERRIDES, FLOWCHART_ATTRIBUTE_OVERRIDES),
});
```

```ts
// posts.server.ts — HTML rendering, with the flowchart placeholder filled in
import { createHtmlRenderer } from '@thomasfosterau/prosekit-utilities/prosekit';
import { postProcessFlowcharts } from '@thomasfosterau/prosekit-flowchart/node';
import { blockDocumentSchema } from './document-schema.ts';

export const blockRenderer = createHtmlRenderer({
  schema: blockDocumentSchema.schema,
  postProcess: postProcessFlowcharts,
});
```

```ts
// markdown.ts — the Markdown serialiser, with the flowchart placeholder text
import { createMarkdownSerialiser } from '@thomasfosterau/prosekit-utilities';
import { flowchartMarkdown } from '@thomasfosterau/prosekit-flowchart/node';

export const toMarkdown = createMarkdownSerialiser({
  blocks: { flowchart: flowchartMarkdown() },
});
```

```svelte
<!-- Editor.svelte — the editor route: schema half + UI half, composed once -->
<script lang="ts">
  import {
    BlockEditor,
    createDefaultSlashCommands,
    createDefaultToolbarItems,
  } from '@thomasfosterau/prosekit-svelte';
  import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import { defineFlowchart } from '@thomasfosterau/prosekit-flowchart/node';
  import {
    defineFlowchartNodeView,
    flowchartSlashCommand,
    flowchartToolbarItem,
  } from '@thomasfosterau/prosekit-flowchart';
  import { union } from 'prosekit/core';

  const appExtension = defineBlockDocumentExtension(defineFlowchart());

  // The schema half and the view half, composed once.
  const extension = union(appExtension, defineFlowchartNodeView());

  const items = [...createDefaultToolbarItems(), flowchartToolbarItem()];
  const slashCommands = [...createDefaultSlashCommands(), flowchartSlashCommand()];

  let content = $state();
</script>

<BlockEditor {extension} {items} {slashCommands} bind:content />
```

Server-side, an application keeps only `./node`: `defineFlowchart()` in the extension its document schema derives from, `FLOWCHART_ATTRIBUTE_OVERRIDES` in its attribute overlay, `postProcessFlowcharts` in its HTML renderer, and `flowchartMarkdown()` in its Markdown serialiser. Nothing on that path imports Svelte or `@xyflow/svelte`.

---

# `./node`

The flowchart block without a canvas. Imports no Svelte and no `@xyflow/svelte` — the build proves it, since `dist/node/*.js` contains neither specifier — so it is safe on a server, in a Worker, and in any bundle that never renders the interactive canvas; the root entry is what pulls those in.

```ts
import { defineFlowchart } from '@thomasfosterau/prosekit-flowchart/node';
```

| Export | Signature | Notes |
| --- | --- | --- |
| `FlowchartNode`, `FlowchartEdge`, `FlowchartData` | Effect Schemas (each also the decoded type of the same name): `Schema.Struct({ id, position: { x, y }, data: { label } })`, `Schema.Struct({ id, source, target })`, `Schema.Struct({ nodes: Schema.Array(FlowchartNode), edges: Schema.Array(FlowchartEdge) })` | The persisted shape — a strict subset of what the canvas's own dependency (Svelte Flow) accepts, so its internal fields (selection, measured dimensions) never round-trip. |
| `FlowchartPosition` | `type FlowchartPosition = FlowchartNode['position']` | Derived, not a separate schema. |
| `EMPTY_FLOWCHART` | `FlowchartData` (`{ nodes: [], edges: [] }`) | The node spec's attribute default and `parseFlowchartData`'s failure value. |
| `parseFlowchartData` | `(input: string) => FlowchartData` | Total, never throws. Invalid JSON or a non-object JSON value both yield a fresh `{ ...EMPTY_FLOWCHART }`; missing or non-array `nodes` / `edges` default to `[]`; each node and edge is decoded **individually**, so one malformed entry is dropped rather than failing the whole array. |
| `generateFlowchartSvg`, `FlowchartSvgLabels` | `(data: FlowchartData, labels?: FlowchartSvgLabels) => string`; `interface FlowchartSvgLabels { emptyLabel?: string \| undefined; diagramLabel?: ((nodeCount: number) => string) \| undefined; untitledLabel?: string \| undefined }` | The three hard-coded strings ("Empty flowchart", `Flowchart diagram with ${n} node(s)`, "Untitled") are individually overridable through `labels`, and each still defaults to that exact copy. Uses `currentColor` strokes and text, `width="100%"`, a viewBox derived from persisted positions plus 20px padding; a label's XML-sensitive characters are escaped. |
| `defineFlowchart` | `() => Extension` | Registers the `flowchart` node spec (`group: 'block'`, `atom: true`, `isolating: true`, `draggable: true`, `selectable: true`) and the `updateFlowchartData(pos, data)` command. `toDOM` emits `<div data-flowchart data-payload="…">` with the JSON unicode-escaped (`<`, `>`, `&`, `'` → `\uXXXX`) so a label can never break out of the attribute; `parseDOM` prefers `data-payload`, falling back to the element's `textContent` for older documents, then to `parseFlowchartData`'s empty-payload default for anything unparseable. `updateFlowchartData` is a no-op (returns `false`, no dispatch) when the target position is not a `flowchart` node. |
| `FLOWCHART_ATTRIBUTE_OVERRIDES` | `Readonly<Record<string, Readonly<Record<string, Schema.Top \| RequiredAttribute>>>>` — `{ flowchart: { data: required(FlowchartData) } }` | The overlay entry a consuming app merges into its own attribute overlay (see [Wiring the block into an editor](#wiring-the-block-into-an-editor)). Wrapped in `required(...)`: a live editor's `flowchart` node always serialises `data` (`Node.toJSON()` includes every attribute, defaulted or not), so a machine-authored document must supply it too. |
| `postProcessFlowcharts` | `(html: string, document: Document) => string` | The `createHtmlRenderer({ postProcess })` hook: replaces every `[data-flowchart]` placeholder's inner HTML with `generateFlowchartSvg`'s output, keeping `data-payload` so the editor can still round-trip the diagram. Short-circuits (returns `html` unchanged) when the string contains no `data-flowchart` at all. Takes the caller's `Document` implementation rather than constructing one, so it works from both a browser bundle and a server-side DOM (linkedom, …). |
| `flowchartMarkdown` | `(label?: string) => BlockSerialiser` | Default label `'_[flowchart diagram]_'`. A **factory**, unlike this workspace's other opt-in serialisers (`mentionMarkdown`, `figureMarkdown`, `sidenoteMarkdown`), so a consuming app can override the placeholder text without reimplementing the `BlockSerialiser`. Ignores the node's own content — nothing in a `FlowchartData` payload has a faithful Markdown form. |

---

# root

The `@xyflow/svelte` canvas, the edit dialog, the editable node, the ProseKit node view and the toolbar / insert-menu entries. Everything is exported from the package root:

```ts
import {
  EditableNode,
  Flowchart,
  FlowchartEditDialog,
  FlowchartNodeView,
  defineFlowchartNodeView,
  flowchartSlashCommand,
  flowchartToolbarItem,
} from '@thomasfosterau/prosekit-flowchart';
```

| Component | Purpose | Props | Snippets | ARIA |
| --- | --- | --- | --- | --- |
| `Flowchart` | The canvas itself. `interactive={false}` (the default) is a read-only render — no panning, no connecting, nodes immovable, no `Controls`; `interactive={true}` is the full WYSIWYG surface. There is deliberately no `onchange`: the parent pulls the diagram with `getSnapshot()` on save, which keeps the data flow one-way. | `data: FlowchartData` (seeds the canvas once — use `resetTo()` to replace it), `interactive?: boolean \| undefined` (default `false`), `class?: string \| undefined` (default `'h-96'`, merged after `flowchart-canvas`), `summaryLabel?: ((nodes: number, edges: number) => string) \| undefined`, `newNodeLabel?: string \| undefined` (default `'New'`), `nodeLabelLabel?: string \| undefined` (default `'Node label'`), `untitledLabel?: string \| undefined` (default `'Untitled'`), plus native `<div>` attributes (`class` excepted, spread on the container) | — | Server render (`typeof window === 'undefined'`) emits a `<p>` naming `summaryLabel(nodeCount, edgeCount)` in place of the canvas, which hydration replaces; once hydrated, `@xyflow/svelte`'s own accessibility surface applies. |
| `EditableNode` | The Svelte Flow node type `Flowchart` registers as `editable`. Double-click, or Enter while the node has focus, opens the label field; Enter commits, Escape discards, and a blank label commits as `untitledLabel`. | `NodeProps` narrowed to `id`, `data: EditableNodeData`, `selected` — Svelte Flow instantiates it from the `nodeTypes` map, so there is no call site to pass a prop at. Its copy rides in `data.labels.nodeLabelLabel` / `data.labels.untitledLabel` instead, which `Flowchart` fills from its own same-named props (`EditableNodeData` / `EditableNodeLabels` are this `.svelte` file's own module exports, not re-exported from the package root). | — | `role="button"`; in the tab order (`tabindex="0"`) only while editable (`data.readOnly !== true`) — a reader tabbing through a published diagram is not stopped at every box. The edit field is named by `nodeLabelLabel`. |
| `FlowchartEditDialog` | The modal that hosts the full WYSIWYG canvas, on bits-ui's `Dialog`. The one behaviour that is this component's own: while `onSave` is in flight, both buttons are disabled and Escape is refused, so a save is never abandoned halfway. | `open?: boolean \| undefined` (bindable, default `false`), `initialData?: FlowchartData \| undefined` (default `EMPTY_FLOWCHART`), `onSave: (data: FlowchartData) => void \| Promise<void>` (may reject), `titleLabel?: string \| undefined` (default `'Edit flowchart'`), `addNodeLabel?: string \| undefined` (default `'Add node'`), `helpText?: string \| undefined`, `saveLabel?` / `savingLabel?: string \| undefined` (default `'Save'` / `'Saving…'`), `cancelLabel?: string \| undefined` (default `'Cancel'`), `closeLabel?: string \| undefined` (default `'Close'`), `failureMessage?: string \| undefined` (shown when `onSave` rejects with something that is not an `Error`), `newNodeLabel?`, `nodeLabelLabel?`, `untitledLabel?: string \| undefined` (forwarded to the hosted `Flowchart`), `class?: string \| undefined` (merged onto the `modal-box`) | — | bits-ui's `Dialog` owns the focus trap, `aria-modal`, the `aria-labelledby` / `aria-describedby` wiring to `Dialog.Title` / `Dialog.Description`, the scroll lock and the focus return. The failure message renders in a `role="alert"`. |
| `FlowchartNodeView` | What ProseKit mounts in place of a `flowchart` node. Its preview is the **same** server-renderable SVG a reader page gets (`generateFlowchartSvg`, from `./node`), so the editor and the published article cannot drift — and so the `@xyflow/svelte` bundle only arrives once the author presses Edit. | `node: Writable<ProseMirrorNode>` (ProseKit's node store), `selected: Writable<boolean>` (ProseKit's selection store), `setAttrs: (attrs: Attrs) => void` (the save channel — Save writes `{ data }` back through it), `editLabel?: string \| undefined` (default `'Edit'`) | — | The wrapper is `contenteditable="false"` and carries `data-prosemirror-node-name="flowchart"`; its border reflects `$selected`. The Edit button is named by `editLabel`. |

Instance methods on `Flowchart`, reached through `bind:this`:

| Method | Signature | What it does |
| --- | --- | --- |
| `resetTo` | `(payload: FlowchartData) => void` | Replaces the canvas state. Call it once the canvas has a layout box, so `fitView` has something to fit — `FlowchartEditDialog` calls it inside a `queueMicrotask` after the dialog's content mounts. |
| `getSnapshot` | `() => FlowchartData` | The persisted shape, with `@xyflow/svelte`'s internal fields (selection, measured dimensions) stripped. |
| `addNode` | `(label?: string) => void` | Appends a node at a staggered position (diagonally offset by 30px per existing node), so repeated presses do not pile up. Defaults to `newNodeLabel`. |

`FlowchartEditDialog` also exposes an imperative `open(data?: FlowchartData): void`, reached the same way — the entry point `FlowchartNodeView` uses, since it has an instance to reach through `bind:this` but no place to thread a bound prop.

`defineFlowchartNodeView(): Extension` registers `FlowchartNodeView` under the node name `flowchart`, hosted in a `div`, with `ignoreMutation` and `stopEvent` both returning `true` — the diagram rewrites its own DOM (the SVG preview, and the canvas while the dialog is open), and without those guards ProseMirror would read the rewrites as document edits.

The toolbar and insert-menu entries:

| Export | Signature | Notes |
| --- | --- | --- |
| `flowchartToolbarItem` | `(label?: string) => ToolbarItem` | A toolbar button (`kind: 'action'` — inserting a block has no pressed state) that inserts a `flowchart` node and returns focus to the document. Default label `'Flowchart'`. |
| `flowchartSlashCommand` | `(label?: string) => SlashCommand` | The same insertion, as an insert-menu entry. Default label `'Flowchart'`. |

Both insert the starter diagram — one node labelled `'Start'` at `(120, 80)` — rather than an empty payload, because an empty canvas gives an author nothing to double-click and no anchor to drag a connection from. Each insertion builds its own diagram object, so two blocks never share one payload. The insertion is reached by name through the editor's own `commands`, so an entry added to a toolbar whose extension never registered `defineFlowchart()` is inert rather than throwing.

## Import boundary

- **Siblings only through their published entry points.** `@thomasfosterau/prosekit-utilities` (root and `./derive`) and `@thomasfosterau/prosekit-svelte` are `workspace:*` dependencies resolved through their `exports`, i.e. their built `dist/` — never a relative path into another package's `src/`. That is why `check`, `build` and `test:unit` take a `{ task: 'build', from: 'dependencies' }` edge.
- **`./node` imports no Svelte and no `@xyflow/svelte`**, and the build proves it (`dist/node/*.js` contains neither specifier). It is the half a server render and a document-schema declaration need; the canvas is reached only from the root.
- **The engine is reached once, from one place.** `Flowchart.svelte` is the only module that imports `@xyflow/svelte` and its stylesheet; the node view previews a flowchart with the same SVG the server renders, so the `@xyflow/svelte` bundle only loads when a user opens the edit dialog — a document that merely contains a flowchart never pays for it.

## Testing

Suites run under Vitest browser mode, headless Chromium via Playwright, the same mechanics as the sibling Svelte package. `tests/node/` covers the `./node` entry — a mounted ProseMirror view is available, because the suite runs in a real browser rather than node Vitest — and one file per component covers the root, asserting accessible name, role, and keyboard path with real pointer and keyboard events.
