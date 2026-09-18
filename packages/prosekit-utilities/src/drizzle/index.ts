/**
 * `@thomasfosterau/prosekit-utilities/drizzle` — jsonb document columns whose
 * row type is the derived Effect Schema, and the SQL twin of text extraction.
 *
 * @module
 */

export { jsonbSchemaColumn } from './jsonb-column.ts';
export { documentColumn, type HasDocumentSchema } from './document-column.ts';
export { documentTextSql } from './document-text-sql.ts';
