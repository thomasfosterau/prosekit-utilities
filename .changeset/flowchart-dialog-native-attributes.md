---
'@thomasfosterau/prosekit-flowchart': minor
---

`FlowchartEditDialog` now accepts the native attributes of its dialog element (`id`, `data-*`, `aria-*`, …) and spreads them on bits-ui's `Dialog.Content` (`role="dialog"`), where `class` already merges. bits-ui's `role`, `aria-modal`, `aria-labelledby` (the title) and `aria-describedby` (the help text) still win.
