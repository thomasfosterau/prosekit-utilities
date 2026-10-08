---
'@thomasfosterau/prosekit-utilities': patch
'@thomasfosterau/prosekit-flowchart': patch
---

The module-load calls to `required(…)` in `STANDARD_ATTRIBUTE_OVERRIDES`, `MENTION_ATTRIBUTE_OVERRIDES` and `FLOWCHART_ATTRIBUTE_OVERRIDES`, and to `createMarkdownSerialiser()` behind `toMarkdown`, now carry a `/* @__PURE__ */` annotation in the published `dist/`, so a consumer's bundler can drop them when unused. No behaviour change: the only difference in the emitted JavaScript is those comments.
