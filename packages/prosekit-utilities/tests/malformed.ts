import * as Schema from 'effect/Schema';
import type { DocumentJSON } from '../src/json.ts';

/**
 * A schema that admits anything and types it as a document. It exists so a
 * case can hand a function a value its declared input type rules out — a
 * stored row can hold one — through a decode instead of a type assertion.
 */
const AnyDocument = /* @__PURE__ */ Schema.declare((_input): _input is DocumentJSON => true);

const decodeAnyDocument = /* @__PURE__ */ Schema.decodeUnknownSync(AnyDocument);

/**
 * A stored-row value the envelope type rules out (no `content` array, a
 * `null` entry, a node missing its `type`, a non-array `marks`, a non-string
 * `text`), typed as a document on purpose: the walks under test run on values
 * only proved to be JSON, so these are reachable.
 */
export const malformed = (value: Schema.Json | DocumentJSON): DocumentJSON =>
  decodeAnyDocument(value);
