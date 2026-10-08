---
'@thomasfosterau/prosekit-utilities': patch
'@thomasfosterau/prosekit-flowchart': patch
---

The module-load calls to `required(…)` in `STANDARD_ATTRIBUTE_OVERRIDES`, `MENTION_ATTRIBUTE_OVERRIDES` and `FLOWCHART_ATTRIBUTE_OVERRIDES`, and to `createMarkdownSerialiser()` behind `toMarkdown`, now carry a `/* @__PURE__ */` annotation in the published `dist/`. A consumer's bundler can now drop `toMarkdown`, `MENTION_ATTRIBUTE_OVERRIDES` and `FLOWCHART_ATTRIBUTE_OVERRIDES` when they're unused. `STANDARD_ATTRIBUTE_OVERRIDES` is still kept, because its arguments include un-annotated `Schema.*` calls. No behaviour change: the only difference in the emitted JavaScript is those comments.
