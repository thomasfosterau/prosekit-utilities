/**
 * A typed `jsonb` Drizzle custom column backed by an Effect Schema.
 *
 * Generalises the apps' `customType` body (Gardeneria's
 * `packages/database/src/columns.ts`, byte-identical to Website's) over an
 * arbitrary codec `A`, so a consumer supplies its own document (or any other
 * JSON-shaped) schema instead of the library naming one.
 *
 * @module
 */
import * as Option from 'effect/Option';
import * as Predicate from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { customType } from 'drizzle-orm/pg-core';

/**
 * The JSON text boundary, expressed as a schema rather than the `JSON`
 * global: encoding runs `Schema.fromJsonString(Schema.Unknown)` forward
 * (`JSON.stringify`) and decoding runs it as a total operation whose `None`
 * replaces the `catch` a hand-rolled `JSON.parse` would need.
 */
const JsonText = Schema.fromJsonString(Schema.Unknown);
const encodeJson = Schema.encodeSync(JsonText);
const decodeJson = Schema.decodeUnknownOption(JsonText);

/**
 * Builds a typed JSONB Drizzle custom column backed by an Effect Schema
 * codec.
 *
 * Values are stored as PostgreSQL `jsonb`. The schema validates on read
 * (`fromDriver`) only — `toDriver` runs `Schema.encodeSync` over the raw
 * value's `Schema.fromJsonString(Schema.Unknown)` wire form, exactly as the
 * apps' `inlineDocument` / `blockDocument` columns do, and does **not** run
 * `schema` itself on the way out. That is deliberate, not an oversight: the
 * write path is validated upstream, at the API edge and by whatever schema
 * governs the value before it reaches this column, and the read path is
 * where a jsonb row earns the strict, derived schema back. Read validation
 * is what closes SEC-XSS-001 on both directions in practice — a hostile row
 * written by any means other than the validated path is refused on the way
 * back out.
 *
 * The runtime driver is expected to be node-pg (`pg`), which already parses
 * `jsonb` columns for you, so `fromDriver`'s `!Predicate.isString(value)`
 * branch is the common case and the `Predicate.isString` branch (parse a
 * JSON string driver value, then validate) exists for a driver that instead
 * hands back raw text.
 *
 * `null` passes through untouched — Drizzle applies the schema only to
 * non-null values, so a nullable column needs no `.nullable()` wrapping here.
 */
export const jsonbSchemaColumn =
  <A>(schema: Schema.Codec<A, A>) =>
  (name: string) => {
    const parse = Schema.decodeUnknownSync(schema);
    return customType<{ data: A; driverData: string }>({
      dataType() {
        return 'jsonb';
      },
      toDriver(value: A) {
        return encodeJson(value);
      },
      fromDriver(value: string): A {
        if (!Predicate.isString(value)) return parse(value);
        return Option.match(decodeJson(value), {
          onNone: () => parse(value),
          onSome: (parsed) => parse(parsed),
        });
      },
    })(name);
  };
