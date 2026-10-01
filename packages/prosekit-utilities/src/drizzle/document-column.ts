/**
 * A `jsonb` document column built from a `DocumentSchema`.
 *
 * @module
 */
import type * as Schema from 'effect/Schema';
import { jsonbSchemaColumn } from './jsonb-column.ts';

/**
 * The one piece of `DocumentSchema` (from
 * `@thomasfosterau/prosekit-utilities/prosekit`) this module needs. The
 * dependency is written structurally, not as an import of that module,
 * because the `./prosekit` family is authored in parallel and the `./drizzle`
 * entry must not import ProseKit at the value or type level (see the root
 * `AGENTS.md`'s "keep ProseKit off the root entry" rule — the same reasoning
 * applies one level over: this entry stays free of the `./prosekit` module
 * graph too, so a consumer can depend on `./drizzle` without pulling in
 * ProseKit transitively).
 */
export interface HasDocumentSchema<A> {
  readonly Document: Schema.Codec<A, A>;
}

// This is the consuming apps' read-path XSS guard (SEC-XSS-001), as their
// `blockDocument` / `inlineDocument` columns apply it.
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
