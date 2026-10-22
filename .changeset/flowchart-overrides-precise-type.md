---
'@thomasfosterau/prosekit-flowchart': patch
---

`FLOWCHART_ATTRIBUTE_OVERRIDES` (from `./node`) is now typed by its exact shape, `{ readonly flowchart: { readonly data: RequiredAttribute } }`, instead of the open `AttributeOverrides` record. Its value is unchanged and it is still accepted wherever an `AttributeOverrides` is, including `mergeAttributeOverrides`.
