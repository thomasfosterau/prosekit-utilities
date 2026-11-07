---
'@thomasfosterau/prosekit-utilities': minor
'@thomasfosterau/prosekit-svelte': minor
'@thomasfosterau/prosekit-flowchart': minor
---

The `prosekit` peer range is now `^0.23.0` (was `^0.22.2`), and the `@prosekit/pm` peer range is now `^0.1.21` (was `^0.1.19`), so prosekit 0.23 satisfies them. Every gate already ran against prosekit 0.23.0 / `@prosekit/pm` 0.1.21, so no code changes. 0.22.x is no longer admitted: a fresh install of it resolves two copies of `@prosekit/core`, which fails ProseKit's own assertion, so it can't be supported. Upgrade prosekit to 0.23 alongside this release.
