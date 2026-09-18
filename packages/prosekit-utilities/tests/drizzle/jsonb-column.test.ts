import * as Schema from 'effect/Schema';
import { pgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { jsonbSchemaColumn } from '../../src/drizzle/jsonb-column.ts';

const Widget = Schema.Struct({
  kind: Schema.Literal('widget'),
  count: Schema.Number,
});
type Widget = typeof Widget.Type;

/**
 * `pgTable` is how Drizzle's `customType` builder gets its `mapToDriverValue`
 * / `mapFromDriverValue` pair wired up — the built `PgColumn` exposes them,
 * which is the public surface the source apps' columns are exercised through
 * too (there is no lower-level entry point for a `customType`).
 */
const table = pgTable('t', {
  widget: jsonbSchemaColumn(Widget)('widget'),
});

describe('jsonbSchemaColumn', () => {
  it('round-trips a valid value through toDriver then fromDriver', () => {
    const value: Widget = { kind: 'widget', count: 3 };
    const driver = table.widget.mapToDriverValue(value) as string;
    expect(typeof driver).toBe('string');
    expect(table.widget.mapFromDriverValue(driver)).toEqual(value);
  });

  it('throws on the read side for an invalid parsed value', () => {
    const driver = JSON.stringify({ kind: 'gadget', count: 3 });
    expect(() => table.widget.mapFromDriverValue(driver)).toThrow();
  });

  it('parses then validates a JSON string driver value', () => {
    const driver = JSON.stringify({ kind: 'widget', count: 5 });
    expect(table.widget.mapFromDriverValue(driver)).toEqual({ kind: 'widget', count: 5 });
  });

  it('validates a non-string driver value directly (already-parsed jsonb)', () => {
    // node-pg already parses jsonb before Drizzle ever sees it — this is the
    // common case in production, and the one the source comment calls out as
    // making the JSON-string branch above dead under that driver.
    const parsed = { kind: 'widget', count: 7 };
    expect(table.widget.mapFromDriverValue(parsed as never)).toEqual(parsed);
  });

  it('throws on the read side when a non-string driver value is invalid', () => {
    expect(() => table.widget.mapFromDriverValue({ kind: 'gadget' } as never)).toThrow();
  });

  it('encodes toDriver as the raw value, without running the schema', () => {
    // The write path is intentionally unvalidated here (see the doc comment
    // on jsonbSchemaColumn): toDriver must accept a shape the schema would
    // reject and simply JSON-encode it.
    const invalid = { kind: 'gadget', count: 'nope' };
    expect(() => table.widget.mapToDriverValue(invalid as never)).not.toThrow();
    expect(JSON.parse(table.widget.mapToDriverValue(invalid as never) as string)).toEqual(invalid);
  });
});
