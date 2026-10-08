---
'@thomasfosterau/prosekit-svelte': minor
---

`BlockEditor`, `InlineEditor`, `BlockToolbar` and `SlashMenu` now accept the native attributes of the element they render (`id`, `data-*`, `aria-*`, …, except `aria-label` and `aria-labelledby`: the component owns its accessible name) and spread them before their own, so the caller's `class` still merges last. `BlockEditor` and `InlineEditor` forward them to `Editor`'s wrapper; `BlockToolbar` puts them on its `role="toolbar"` element; `SlashMenu` puts them on its `role="menu"` content (an `id` there becomes the trigger's `aria-controls`), while `class` stays on the styling list inside it.
