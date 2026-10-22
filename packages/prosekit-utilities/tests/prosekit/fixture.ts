/**
 * Representative document surfaces for the `./prosekit` suites.
 *
 * {@link createDocumentFixture} is a block grammar carrying every opt-in node
 * and mark the library ships, and an inline grammar with the standard marks
 * only. Their mark sets differ (the block grammar adds `citation`), so each
 * gets its own registry cache: grammars may share one only when their mark
 * sets match (see `defineDocumentSchema`).
 *
 * {@link createSharedCacheFixture} is the pair that may share a cache: the same
 * block grammar without `citation`, whose marks match the inline grammar's.
 *
 * Built by factories rather than exported as module constants because
 * `install()` is a per-isolate, irreversible upgrade of a shape: a suite that
 * installs needs shapes nobody else is watching.
 */

import { assert } from 'vite-plus/test';
import * as Predicate from 'effect/Predicate';
import { defineDocumentShape, type DocumentShape } from '../../src/document-shape.ts';
import { createRegistryCache, type RegistryCache } from '../../src/derive/index.ts';
import {
  MENTION_ATTRIBUTE_OVERRIDES,
  mergeAttributeOverrides,
  STANDARD_ATTRIBUTE_OVERRIDES,
} from '../../src/prosekit/attribute-overrides.ts';
import { defineDocumentSchema, type DocumentSchema } from '../../src/prosekit/document-schema.ts';
import { defineCitation } from '../../src/prosekit/marks.ts';
import { defineFigure, defineMention, defineSidenote } from '../../src/prosekit/nodes.ts';
import {
  defineBlockDocumentExtension,
  defineInlineDocumentExtension,
} from '../../src/prosekit/presets.ts';

export interface DocumentFixture {
  readonly blockCache: RegistryCache;
  readonly inlineCache: RegistryCache;
  readonly blockShape: DocumentShape<'blockDocument'>;
  readonly inlineShape: DocumentShape<'inlineDocument'>;
  readonly block: DocumentSchema<'blockDocument'>;
  readonly inline: DocumentSchema<'inlineDocument'>;
}

const createPair = (
  withCitation: boolean,
  blockCache: RegistryCache,
  inlineCache: RegistryCache,
): DocumentFixture => {
  const blockShape = defineDocumentShape({ name: 'blockDocument' });
  const inlineShape = defineDocumentShape({ name: 'inlineDocument' });

  return {
    blockCache,
    inlineCache,
    blockShape,
    inlineShape,
    block: defineDocumentSchema(blockShape, {
      extension: () =>
        defineBlockDocumentExtension(
          defineMention(),
          defineFigure(),
          ...(withCitation ? [defineCitation()] : []),
          defineSidenote(),
        ),
      attributes: mergeAttributeOverrides(
        STANDARD_ATTRIBUTE_OVERRIDES,
        MENTION_ATTRIBUTE_OVERRIDES,
      ),
      registryCache: blockCache,
    }),
    inline: defineDocumentSchema(inlineShape, {
      extension: () => defineInlineDocumentExtension(),
      registryCache: inlineCache,
    }),
  };
};

/**
 * A fresh, uninstalled block/inline pair. The block grammar adds `citation`,
 * so the two have different mark sets and each derives against its own cache.
 */
export const createDocumentFixture = (): DocumentFixture =>
  createPair(true, createRegistryCache(), createRegistryCache());

/**
 * A fresh, uninstalled block/inline pair with matching mark sets (no
 * `citation`), sharing one registry cache the way a consuming application may.
 * `blockCache` and `inlineCache` are the same object.
 */
export const createSharedCacheFixture = (): DocumentFixture => {
  const cache = createRegistryCache();
  return createPair(false, cache, cache);
};

/**
 * `value`, asserted present: a missing node, mark, child or spec hook fails the
 * case by name instead of surfacing later as a `TypeError`.
 */
export const present = <A>(value: A, what: string): NonNullable<A> => {
  assert(Predicate.isNotNullish(value), `${what} is present`);
  return value;
};
