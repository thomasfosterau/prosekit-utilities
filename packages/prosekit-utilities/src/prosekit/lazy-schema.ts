/**
 * Compile a ProseMirror schema once per isolate, on first use.
 *
 * @module
 */

import * as Option from 'effect/Option';
import { createEditor, type Extension } from 'prosekit/core';
import type { Schema as PmSchema } from '@prosekit/pm/model';

/**
 * Wraps an extension factory in a compile-once, cache-forever thunk.
 *
 * ```ts
 * const schema = lazySchema(() => defineBlockDocumentExtension(defineMention()));
 * schema() === schema(); // the same compiled instance, for the life of the isolate
 * ```
 *
 * **Why lazy.** Compiling a ProseMirror schema builds the whole node and mark
 * registry and the content-match automata for every content expression in it.
 * It is expensive, and the result never changes at runtime. Doing it at module
 * scope would charge that cost to every bundle that so much as names a
 * document type; doing it per call charges it per use.
 *
 * Anything on a per-row or per-render path must go through a thunk like
 * this one, never `createEditor` directly.
 */
export function lazySchema(define: () => Extension): () => PmSchema {
  let compiled: Option.Option<PmSchema> = Option.none();
  return () => {
    if (Option.isNone(compiled)) {
      const schema = createEditor({ extension: define() }).schema;
      compiled = Option.some(schema);
      return schema;
    }
    return compiled.value;
  };
}
