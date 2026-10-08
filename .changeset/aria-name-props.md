---
'@thomasfosterau/prosekit-svelte': minor
---

**Breaking (types):** `Editor`, `BlockEditor`, `InlineEditor`, `BlockToolbar` and `SlashMenu` no longer accept `aria-label` or `aria-labelledby` among their native attributes: each owns its accessible name through `label` (`menuLabel` for `SlashMenu`), and passing either is now a type error. Before, a caller's `aria-label` was silently overridden by `label`, and a caller's `aria-labelledby` passed through and outranked it. At runtime an untyped caller's `aria-label` is still overridden, and its `aria-labelledby` is now dropped. Name the editor or menu with `label` / `menuLabel`. The dialogs are unchanged.
