---
'@thomasfosterau/prosekit-svelte': minor
---

`LinkDialog` and `ImageDialog` now accept the native attributes of their dialog element (`id`, `data-*`, `aria-*`, …) and spread them on bits-ui's `Dialog.Content` (`role="dialog"`), where `class` already merges. bits-ui's `role`, `aria-modal` and `aria-labelledby` (the title) still win; with no description of its own, a caller's `aria-describedby` is kept. `LinkDialog` leaves out the native `title`, which is the link's title there.
