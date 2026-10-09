---
'@thomasfosterau/prosekit-flowchart': patch
---

Every call to Effect's `Schema` that runs when a `./node` module loads now carries a `/* @__PURE__ */` annotation in the published `dist/`: the `FlowchartNode` / `FlowchartEdge` / `FlowchartData` schemas and the payload's JSON decoders and encoder. A bundler that honours the annotation can drop the ones a consumer doesn't use. Measured with esbuild 0.28.2: a bundle that imports only `EMPTY_FLOWCHART` from `./node` no longer pulls in Effect's `Schema` module (74,159 → 42 bytes minified), and one that imports only `FlowchartEdge` no longer keeps `FlowchartNode` or `FlowchartData`. No behaviour change: the emitted JavaScript changes only by those comments and two line breaks, and the `.d.ts` files are unchanged.
