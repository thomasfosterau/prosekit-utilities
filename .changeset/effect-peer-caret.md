---
'@thomasfosterau/prosekit-utilities': patch
'@thomasfosterau/prosekit-flowchart': patch
---

The `effect` peer range is now `^4.0.0` (was `>=4.0.0-rc.118`), per the peer-range policy: no dependency needs more (`drizzle-orm`, the `./drizzle` entry's peer, accepts `effect >=4.0.0`), and the type gate, the core's suite, the browser suites, the build and `check:dist` pass against effect 4.0.0. Only the range's form changes: it no longer admits Effect 5 or the 4.0.0 release candidates. No code changes.
