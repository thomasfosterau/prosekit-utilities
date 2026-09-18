/**
 * The SQL twin of `extractDocumentText` (the root entry's text extraction).
 *
 * @module
 */
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';

/**
 * The `jsonb_path_query_array` text-extraction fragment Gardeneria's
 * `block_document_view` / `inline_document_view` materialised views use
 * (`packages/database/src/tables/nodes.ts`), lifted out so both apps'
 * document-storing views can share one fragment and test it against the same
 * fixtures as `extractDocumentText` (`packages/editor/src/document-text.ts`'s
 * JS twin, which walks the same tree and joins `text` leaves with a single
 * space).
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
