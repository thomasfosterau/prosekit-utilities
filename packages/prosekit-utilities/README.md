# @thomasfosterau/prosekit-utilities

A ProseKit document grammar as data: browser-cheap document envelopes and allow-lists, an [Effect Schema](https://effect.website) derived at runtime from a compiled ProseMirror schema, HTML and Markdown serialisation, and Drizzle `jsonb` document columns. Four entry points split by what they cost to import, so a browser-reachable model layer can name a document type without shipping the editor.

## Installation

```sh
pnpm add @thomasfosterau/prosekit-utilities effect prosekit @prosekit/pm
```

| Package | Range | Needed by |
| --- | --- | --- |
| `effect` | `^4.0.0` | Required. Every entry point. |
| `prosekit` | `^0.23.0` | `./prosekit` only. |
| `@prosekit/pm` | `^0.1.21` | `./prosekit` only (and `./derive`'s types). |
| `drizzle-orm` | `^1.0.0-rc.5` | Optional. `./drizzle` only. |
| `linkedom` | `^0.18.13` | Optional. `./prosekit`'s `createHtmlRenderer`, when rendering on a server with no global `document` ([HTML and Markdown](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/html-and-markdown.md)). |

A consumer that only imports the root entry needs `effect` alone; `prosekit` and `@prosekit/pm` are declared peers because `./prosekit` is part of the package, but nothing outside that entry imports them.

## Example

```ts
import { defineDocumentEnvelope } from '@thomasfosterau/prosekit-utilities';

export const blockDocument = defineDocumentEnvelope({ name: 'blockDocument' });

blockDocument.is({ type: 'blockDocument', content: [] }); // true
blockDocument.Schema; // the Effect Schema codec, for decoding at a persistence seam
```

## Entry points

| Entry | Main exports | ProseKit at runtime |
| --- | --- | --- |
| `.` | `defineDocumentEnvelope`, `defineAllowList`, `checkAllowList`, `isSafeHref`, `extractDocumentText`, `extractMentions`, `toEditorDocument`, `createMarkdownSerialiser` | Never |
| `./derive` | `deriveDocumentSchema`, `deriveDocumentSchemas`, `attributeOverlay`, `required` | Never (types only) |
| `./prosekit` | `defineDocumentSchema`, `installDocumentGrammars`, `defineBlockDocumentExtension`, `defineMention`, `createHtmlRenderer` | Yes |
| `./drizzle` | `documentColumn`, `jsonbSchemaColumn`, `documentTextSql` | Never |

## Links

- [Document surfaces](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/document-surfaces.md): envelopes, allow-lists, the write seam, wire compatibility
- [Derivation](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/derivation.md), [nodes, marks and presets](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/nodes-and-marks.md), [HTML and Markdown](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/html-and-markdown.md), [Drizzle columns](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/drizzle.md)
- [CHANGELOG](CHANGELOG.md), [CONTRIBUTING](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/CONTRIBUTING.md), [AGENTS.md](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/AGENTS.md), [PUBLISHING](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/PUBLISHING.md), [SECURITY](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/SECURITY.md)
