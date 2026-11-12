---
'@thomasfosterau/prosekit-utilities': minor
---

`RegistryCache`'s `nodeCache` and `markCache` are now `effect/MutableHashMap`s instead of native `Map`s. Code that only passes a cache from `createRegistryCache()` to `Registry` or `defineDocumentSchema` is unaffected; code that reads the fields directly uses `MutableHashMap.get` / `has` / `size`. The derived schemas are unchanged.
