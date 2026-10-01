/**
 * The SQL twin of `extractDocumentText` (the root entry's text extraction).
 *
 * @module
 */
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';

// Lifted from the consuming apps' document materialised views so every app
// shares one fragment, tested against the same fixtures as the JS twin.
/**
 * A SQL fragment yielding a jsonb document's `text` leaves joined by single
 * spaces — the database twin of `extractDocumentText` (the root entry), for a
 * generated or materialised search column.
 *
 * `jsonb_path_query_array(column, 'strict $.** ? (@.type == "text").text')`
 * collects every `text` leaf's `.text` value, in document order, as a jsonb
 * array; `jsonb_array_elements_text` unnests it to `text` rows;
 * `array_to_string(array(...), ' ')` joins them with the same `' '`
 * separator `extractDocumentText`'s default uses — so a row's generated or
 * materialised text column agrees with what the JS function would compute
 * over the same document.
 */
export const documentTextSql = (column: AnyPgColumn | SQL): SQL<string> =>
  sql<string>`array_to_string(array(SELECT jsonb_array_elements_text(jsonb_path_query_array(${column}, 'strict $.** ? (@.type == "text").text'))), ' ')`;
