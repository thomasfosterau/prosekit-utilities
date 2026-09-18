/**
 * A representative pair of document surfaces for the `./prosekit` suites: a
 * block grammar carrying every opt-in node and mark the library ships, and an
 * inline grammar, sharing one registry cache the way a consuming application's
 * would.
 *
 * Built by a factory rather than exported as module constants because
 * `install()` is a per-isolate, irreversible upgrade of a shape: a suite that
 * installs needs shapes nobody else is watching.
 */

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
  readonly cache: RegistryCache;
  readonly blockShape: DocumentShape<'blockDocument'>;
  readonly inlineShape: DocumentShape<'inlineDocument'>;
  readonly block: DocumentSchema<'blockDocument'>;
  readonly inline: DocumentSchema<'inlineDocument'>;
}

/** A fresh, uninstalled block/inline pair sharing one registry cache. */
export const createDocumentFixture = (): DocumentFixture => {
  const cache = createRegistryCache();
  const blockShape = defineDocumentShape({ name: 'blockDocument' });
  const inlineShape = defineDocumentShape({ name: 'inlineDocument' });

  return {
    cache,
    blockShape,
    inlineShape,
    block: defineDocumentSchema(blockShape, {
      extension: () =>
        defineBlockDocumentExtension(
          defineMention(),
          defineFigure(),
          defineCitation(),
          defineSidenote(),
        ),
      attributes: mergeAttributeOverrides(
        STANDARD_ATTRIBUTE_OVERRIDES,
        MENTION_ATTRIBUTE_OVERRIDES,
      ),
      registryCache: cache,
    }),
    inline: defineDocumentSchema(inlineShape, {
      extension: () => defineInlineDocumentExtension(),
      registryCache: cache,
    }),
  };
};
