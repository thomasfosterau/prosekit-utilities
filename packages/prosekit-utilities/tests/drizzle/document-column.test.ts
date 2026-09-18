import * as Schema from 'effect/Schema';
import { pgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { documentColumn } from '../../src/drizzle/document-column.ts';

/**
 * A structural stand-in for `DocumentSchema` from
 * `@thomasfosterau/prosekit-utilities/prosekit` — `documentColumn` only ever
 * reads `.Document` off what it's given, so this is enough to exercise the
 * delegation without importing the `./prosekit` family (which this module
 * must not depend on either).
 */
const FakeDocumentSchema = {
  Document: Schema.Struct({
    type: Schema.Literal('doc'),
    content: Schema.Array(Schema.Unknown),
  }),
};
type FakeDocument = typeof FakeDocumentSchema.Document.Type;

const table = pgTable('t', {
  document: documentColumn(FakeDocumentSchema)('document'),
});

describe('documentColumn', () => {
  it('delegates to the Document codec: a valid document round-trips', () => {
    const value: FakeDocument = { type: 'doc', content: [] };
    const driver = table.document.mapToDriverValue(value) as string;
    expect(table.document.mapFromDriverValue(driver)).toEqual(value);
  });

  it('delegates to the Document codec: an invalid document throws on read', () => {
    const driver = JSON.stringify({ type: 'not-a-doc', content: [] });
    expect(() => table.document.mapFromDriverValue(driver)).toThrow();
  });
});
