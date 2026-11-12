# Drizzle columns

`jsonb` document columns for `drizzle-orm`'s Postgres dialect, from `@thomasfosterau/prosekit-utilities/drizzle`. The entry never imports ProseKit, so a persistence module can depend on it alone. `drizzle-orm` is an optional peer. The API reference is the TSDoc on each export.

| Export | Notes |
| --- | --- |
| `jsonbSchemaColumn` | Generalises the apps' `customType` body over any codec: `dataType() = 'jsonb'`, `toDriver` = `Schema.encodeSync` over the wire form, `fromDriver` = a three-branch decode (string driver value / already-parsed / non-string) that validates. `null` passes through untouched. Validates on read only — the write path is trusted upstream. |
| `documentColumn` | `jsonbSchemaColumn(schema.Document)` — the strict, ProseKit-derived schema, SEC-XSS-001 on the read direction. Pass a `DocumentSchema` from `./prosekit`. |
| `HasDocumentSchema<A>` | The one piece of `./prosekit`'s `DocumentSchema` this entry needs, written structurally so `./drizzle` never imports `./prosekit` (or ProseKit) at all — a consumer can depend on this entry alone. |
| `documentTextSql` | The `jsonb_path_query_array(... 'strict $.** ? (@.type == "text").text')` fragment, unnested and joined with `' '` — the SQL twin of `extractDocumentText` (the root entry), tested against the same fixtures. |

```ts
import { pgTable, uuid } from 'drizzle-orm/pg-core';
import {
  documentColumn,
  documentTextSql,
  jsonbSchemaColumn,
} from '@thomasfosterau/prosekit-utilities/drizzle';
import { blockDocumentSchema } from './document-schemas.ts';

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  body: documentColumn(blockDocumentSchema)('body_jsonb').notNull(),
});

// A generated/materialised text column for search, from the same jsonpath
// fragment `extractDocumentText` walks in JS.
export const postSearchText = documentTextSql(posts.body);

// A column backed by a plain Effect Schema, no ProseKit document involved:
export const settings = pgTable('settings', {
  preferences: jsonbSchemaColumn(PreferencesSchema)('preferences_jsonb'),
});
```
