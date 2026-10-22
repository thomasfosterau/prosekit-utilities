---
'@thomasfosterau/prosekit-utilities': major
---

Build and test against `prosemirror-view` 1.42.3 (was 1.41.8), the first release that fixes GHSA-c8x8-7fp4-3x9w, an XSS in ProseMirror's paste handling. The package does not bundle or pin `prosemirror-view` (a consumer resolves it through `@prosekit/pm`), and the emitted `dist/` is unchanged; this is a major because the workspace's exact ProseMirror pins are part of the wire-compatibility contract. The golden wire-fixture suite passes unchanged. Consumers should resolve `prosemirror-view` >= 1.42.3 themselves.
