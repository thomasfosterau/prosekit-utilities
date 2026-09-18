import { jsonb, pgTable, PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { documentTextSql } from '../../src/drizzle/document-text-sql.ts';

const table = pgTable('block_documents', {
  document: jsonb('document_jsonb'),
});

describe('documentTextSql', () => {
  it('renders the jsonpath text-extraction fragment joined with a single space', () => {
    const dialect = new PgDialect();
    const { sql: rendered, params } = dialect.sqlToQuery(documentTextSql(table.document));

    expect(rendered).toBe(
      'array_to_string(array(SELECT jsonb_array_elements_text(jsonb_path_query_array(' +
        `"block_documents"."document_jsonb", 'strict $.** ? (@.type == "text").text'))), ' ')`,
    );
    // The column reference is inlined by the dialect, not parameterised.
    expect(params).toEqual([]);
  });

  it('accepts a raw SQL fragment in place of a column', () => {
    const dialect = new PgDialect();
    const { sql: rendered } = dialect.sqlToQuery(documentTextSql(table.document.getSQL()));

    expect(rendered).toContain('"block_documents"."document_jsonb"');
    expect(rendered).toContain('strict $.** ? (@.type == "text").text');
  });
});
