import * as Predicate from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { pgTable } from 'drizzle-orm/pg-core';
import { assert, describe, expect, it } from 'vite-plus/test';
import { jsonbSchemaColumn } from '../../src/drizzle/jsonb-column.ts';

const Widget = Schema.Struct({
  kind: Schema.Literal('widget'),
  count: Schema.Finite,
});
type Widget = typeof Widget.Type;

/** JSON text in and out, the driver-side representation of a `jsonb` value. */
const JsonText = Schema.fromJsonString(Schema.Unknown);
const encodeJson = Schema.encodeSync(JsonText);
const decodeJson = Schema.decodeUnknownSync(JsonText);

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
    const driver = table.widget.mapToDriverValue(value);
    assert(Predicate.isString(driver), 'toDriver writes JSON text');
    expect(table.widget.mapFromDriverValue(driver)).toEqual(value);
  });

  it('throws on the read side for an invalid parsed value', () => {
    const driver = encodeJson({ kind: 'gadget', count: 3 });
    expect(() => table.widget.mapFromDriverValue(driver)).toThrow();
  });

  it('parses then validates a JSON string driver value', () => {
    const driver = encodeJson({ kind: 'widget', count: 5 });
    expect(table.widget.mapFromDriverValue(driver)).toEqual({ kind: 'widget', count: 5 });
  });

  it('validates a non-string driver value directly (already-parsed jsonb)', () => {
    // node-pg already parses jsonb before Drizzle ever sees it — this is the
    // common case in production, and the one the source comment calls out as
    // making the JSON-string branch above dead under that driver.
    const parsed = { kind: 'widget', count: 7 };
    // SAFETY: the column is typed for the string driver; this case feeds the
    // already-parsed object node-pg hands Drizzle at runtime, on purpose.
    expect(table.widget.mapFromDriverValue(parsed as never)).toEqual(parsed);
  });

  it('throws on the read side when a non-string driver value is invalid', () => {
    // A deliberately invalid, already-parsed driver value (see above).
    expect(() => table.widget.mapFromDriverValue({ kind: 'gadget' })).toThrow();
  });

  it('encodes toDriver as the raw value, without running the schema', () => {
    // The write path is intentionally unvalidated here (see the doc comment
    // on jsonbSchemaColumn): toDriver must accept a shape the schema would
    // reject and simply JSON-encode it.
    const invalid = { kind: 'gadget', count: 'nope' };
    // SAFETY: a value the schema rejects, typed past `Widget` on purpose —
    // the point is that toDriver never validates.
    expect(() => table.widget.mapToDriverValue(invalid as never)).not.toThrow();
    // SAFETY: as above.
    expect(decodeJson(table.widget.mapToDriverValue(invalid as never))).toEqual(invalid);
  });
});
