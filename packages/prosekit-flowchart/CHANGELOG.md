# @thomasfosterau/prosekit-flowchart

## 0.1.0

### Minor Changes

- 0493282: Built and tested against `effect@4.0.0-rc.118`; the `effect` peer range is `>=4.0.0-rc.118`. No public API changed.
- 5aa1d54: First release of the flowchart block (`0.0.0` → `0.1.0`; the package has never been published), split into its own package because it needs `@xyflow/svelte` (a required peer) that the editor package must stay free of.

  - **`./node`** (no Svelte, no xyflow): the `FlowchartData` / `FlowchartNode` / `FlowchartEdge` schemas, `EMPTY_FLOWCHART`, `parseFlowchartData`, `generateFlowchartSvg` (server-renderable, labels as options), `defineFlowchart` (node spec + `updateFlowchartData`), `FLOWCHART_ATTRIBUTE_OVERRIDES`, `postProcessFlowcharts` (the `createHtmlRenderer` hook) and `flowchartMarkdown`.
  - **root**: `Flowchart` (the xyflow canvas; `resetTo`, `getSnapshot`, `addNode`), `EditableNode`, `FlowchartEditDialog` (bits-ui `Dialog`, every string a prop), `FlowchartNodeView` + `defineFlowchartNodeView()`, `flowchartToolbarItem()` and `flowchartSlashCommand()` for `@thomasfosterau/prosekit-svelte`'s toolbar.

- c80bb9c: `FlowchartEditDialog` now accepts the native attributes of its dialog element (`id`, `data-*`, `aria-*`, …) and spreads them on bits-ui's `Dialog.Content` (`role="dialog"`), where `class` already merges. bits-ui's `role`, `aria-modal`, `aria-labelledby` (the title) and `aria-describedby` (the help text) still win.

### Patch Changes

- 80f4cdd: Documentation only: every Svelte component now carries a one-line `@component` doc that editors show on hover; `documentTextSql`, `documentColumn`, `FlowchartSvgLabels` and `parseFlowchartData` have hover summaries free of app-specific names; the package READMEs drop contributor-only sections and no longer overstate which components spread native attributes.
- 207f1ac: Tested against `effect@4.0.0`; peer floor unchanged (`>=4.0.0-rc.118`). No source change: the derived document schema encodes and decodes stored-document fixtures byte-identically to `4.0.0-rc.118`.
- 27f7fb8: `FLOWCHART_ATTRIBUTE_OVERRIDES` (from `./node`) is now typed by its exact shape, `{ readonly flowchart: { readonly data: RequiredAttribute } }`, instead of the open `AttributeOverrides` record. Its value is unchanged and it is still accepted wherever an `AttributeOverrides` is, including `mergeAttributeOverrides`.
- 2da48c9: The module-load calls to `required(…)` in `STANDARD_ATTRIBUTE_OVERRIDES`, `MENTION_ATTRIBUTE_OVERRIDES` and `FLOWCHART_ATTRIBUTE_OVERRIDES`, and to `createMarkdownSerialiser()` behind `toMarkdown`, now carry a `/* @__PURE__ */` annotation in the published `dist/`. A consumer's bundler can now drop `toMarkdown`, `MENTION_ATTRIBUTE_OVERRIDES` and `FLOWCHART_ATTRIBUTE_OVERRIDES` when they're unused. `STANDARD_ATTRIBUTE_OVERRIDES` is still kept, because its arguments include un-annotated `Schema.*` calls. No behaviour change: the only difference in the emitted JavaScript is those comments.
- 41b0909: Every call to Effect's `Schema` that runs when a `./node` module loads now carries a `/* @__PURE__ */` annotation in the published `dist/`: the `FlowchartNode` / `FlowchartEdge` / `FlowchartData` schemas and the payload's JSON decoders and encoder. A bundler that honours the annotation can drop the ones a consumer doesn't use. Measured with esbuild 0.28.2: a bundle that imports only `EMPTY_FLOWCHART` from `./node` no longer pulls in Effect's `Schema` module (74,159 → 42 bytes minified), and one that imports only `FlowchartEdge` no longer keeps `FlowchartNode` or `FlowchartData`. No behaviour change: the emitted JavaScript changes only by those comments and two line breaks, and the `.d.ts` files are unchanged.
- Updated dependencies [9f91e10]
- Updated dependencies [cc59604]
- Updated dependencies [c80bb9c]
- Updated dependencies [80f4cdd]
- Updated dependencies [207f1ac]
- Updated dependencies [0493282]
- Updated dependencies [5aa1d54]
- Updated dependencies [5aa1d54]
- Updated dependencies [9a1f39f]
- Updated dependencies [7a7ce2f]
- Updated dependencies [2da48c9]
- Updated dependencies [e13afc2]
  - @thomasfosterau/prosekit-svelte@0.1.0
  - @thomasfosterau/prosekit-utilities@1.0.0
