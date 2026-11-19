/**
 * A `jsonb` document column built from a `DocumentSchema`.
 *
 * @module
 */
import type * as Schema from 'effect/Schema';
import { jsonbSchemaColumn } from './jsonb-column.ts';

/**
 * The one piece of `DocumentSchema` this module needs, written structurally
 * so `./drizzle` never imports the `./prosekit` module graph.
 */
export interface HasDocumentSchema<A> {
  readonly Document: Schema.Codec<A, A>;
}

/**
 * Builds a `jsonb` document column from a `DocumentSchema` (the value
 * `defineDocumentSchema` returns from `@thomasfosterau/prosekit-utilities/prosekit`).
 *
 * `jsonbSchemaColumn(schema.Document)` — the strict, ProseKit-derived schema,
 * so a row is held to the full document grammar on read (see
 * {@link jsonbSchemaColumn}'s doc comment for why the write path is not
 * re-validated here).
 */
export const documentColumn = <A>(schema: HasDocumentSchema<A>) =>
  jsonbSchemaColumn(schema.Document);
