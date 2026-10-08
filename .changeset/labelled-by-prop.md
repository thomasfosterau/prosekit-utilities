---
'@thomasfosterau/prosekit-svelte': minor
---

`Editor`, `BlockEditor`, `InlineEditor`, `BlockToolbar` and `SlashMenu` take a new `labelledBy` prop: the `id` (or space-separated `id`s) of a visible element, such as a heading, that names the component. Given it, the component renders `aria-labelledby` and no `aria-label`, so the name tracks the visible text and its translations. It wins over `label` / `menuLabel` and their defaults when both are given. `Editor`'s wrapper becomes a `role="group"` when named either way. `BlockEditor` and `InlineEditor` forward it to `Editor`; `BlockToolbar` puts it on its `role="toolbar"` element and `SlashMenu` on its `role="menu"` content. Without it, nothing changes.
