---
'@thomasfosterau/prosekit-svelte': patch
---

Escape from the toolbar's insert menu returns focus to the Insert button again under bits-ui 2.21. Before this fix it was left on the page body: bits-ui 2.21 stopped restoring focus to a trigger with `tabindex="-1"`, which the toolbar's roving tabindex sets.
