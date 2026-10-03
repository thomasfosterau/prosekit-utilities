/**
 * @copyright Thomas Foster
 *
 * The public derivation entry points: turn a ProseKit / ProseMirror node type,
 * mark type, or whole schema into an Effect {@link Schema}.
 *
 * - {@link deriveMarkSchema} — a single mark's `{ type, attrs? }` shape.
 * - {@link deriveNodeSchema} — a single node's recursive shape, using the
 *   node's own `schema` back-reference to resolve its descendants.
 * - {@link deriveDocumentSchema} — a whole document, rooted at the schema's
 *   top node (optionally renamed for an app that renames it at its own layer).
 * - {@link deriveDocumentSchemas} — two or more related whole documents, whose
 *   schemas share a single {@link Registry} so structure they have in common
 *   is derived once instead of once per document.
 *
 * Every function but {@link deriveDocumentSchemas} builds a private
 * {@link Registry} and reads one schema out of it, so a single call yields a
 * self-contained, fully recursive schema.
 *
 * @module @thomasfosterau/prosekit-utilities/derive/Derive
 */

import type { MarkType, NodeType, Schema as PmSchema } from '@prosekit/pm/model';
import { createRegistryCache, Registry } from './Registry.ts';
import type {
  DeriveDocumentOptions,
  DeriveOptions,
  DerivedMarkJSON,
  DerivedNodeJSON,
} from './Options.ts';
import * as Option from 'effect/Option';
import * as Record from 'effect/Record';
import type * as Schema from 'effect/Schema';

/**
 * Derives an Effect schema for a single ProseMirror mark type: a struct with a
 * `type` literal and, when the mark declares attributes, an `attrs` field.
 */
export function deriveMarkSchema(
  markType: MarkType,
  options?: DeriveOptions,
): Schema.Codec<DerivedMarkJSON> {
  return new Registry(markType.schema, options).mark(markType);
}

/**
 * Derives an Effect schema for a single ProseMirror node type, recursively
 * modelling its content via the node's own schema. The result validates a JSON
 * subtree rooted at this node.
 */
export function deriveNodeSchema(
  nodeType: NodeType,
  options?: DeriveOptions,
): Schema.Codec<DerivedNodeJSON> {
  return new Registry(nodeType.schema, options).node(nodeType);
}

/**
 * Derives an Effect schema for a whole document from a ProseMirror schema,
 * rooted at its top node (`schema.topNodeType`, usually `doc`).
 *
 * Pass `topTypeName` to rename the top node's `type` literal — for an
 * application that persists the top node under a different name than
 * ProseMirror's internal `doc` (e.g. `blockDocument`).
 */
export function deriveDocumentSchema(
  schema: PmSchema,
  options?: DeriveDocumentOptions,
): Schema.Codec<DerivedNodeJSON> {
  return documentNode(
    new Registry(schema, options),
    schema,
    Option.fromNullishOr(options?.topTypeName),
  );
}

/** The document-envelope node a {@link deriveDocumentSchema} / {@link deriveDocumentSchemas} entry resolves to. */
function documentNode(
  registry: Registry,
  schema: PmSchema,
  topTypeName: Option.Option<string>,
): Schema.Codec<DerivedNodeJSON> {
  return Option.isNone(topTypeName)
    ? registry.node(schema.topNodeType)
    : registry.nodeAs(schema.topNodeType, topTypeName.value);
}

/** One entry in a {@link deriveDocumentSchemas} call. */
export interface DocumentSchemaSpec {
  /** The compiled ProseMirror schema to derive a document schema from. */
  readonly schema: PmSchema;
  /** Overrides this document's top node `type` literal, as {@link DeriveDocumentOptions.topTypeName}. */
  readonly topTypeName?: string;
}

/**
 * Derives Effect schemas for two or more related ProseMirror document
 * schemas in one call, sharing a single {@link Registry} — and so its
 * mark/node memoization — across all of them.
 *
 * Use this instead of separate {@link deriveDocumentSchema} calls when the
 * schemas are assembled from overlapping ProseKit extensions (e.g. two
 * document types that both compose the same `defineAllMarks()` or
 * `defineText()`): the marks and nodes the schemas have in common are then
 * derived once rather than once per document. The results stay fully
 * independent `Schema.Codec`s — this shares derivation machinery, not the
 * documents' wire shapes.
 *
 * **Precondition:** sharing is by mark/node *name*, so this is only correct
 * when every schema in the call defines same-named marks/nodes identically
 * (the same extension composed into each schema, as opposed to two schemas
 * that coincidentally both declare a differently-shaped type under the same
 * name) **and admits the same set of marks** — an inline node's derived
 * `marks` field is the schema's whole inline mark union, so a schema with an
 * extra mark derives a different `text`. A mismatch would silently resolve
 * to whichever schema's version was derived first, for every schema after
 * it, with no error.
 *
 * All entries are built eagerly in this one call — pass already-compiled
 * schemas. A caller that needs each document to stay independently lazy
 * (e.g. never compiling schema B just because schema A was validated) should
 * instead share a {@link import("./Registry.ts").RegistryCache} across
 * separate `Registry` instances directly, one per schema, each built inside
 * its own deferred call site — the pattern
 * `@thomasfosterau/prosekit-utilities/prosekit`'s `defineDocumentSchema`
 * implements.
 *
 * `options` applies to every schema in the call; use each entry's own
 * `topTypeName` for a per-document top-node rename.
 */
export function deriveDocumentSchemas<Specs extends Record<string, DocumentSchemaSpec>>(
  schemas: Specs,
  options?: DeriveOptions,
): { readonly [K in keyof Specs]: Schema.Codec<DerivedNodeJSON> } {
  const cache = createRegistryCache();
  return Record.map(schemas, ({ schema, topTypeName }) =>
    documentNode(new Registry(schema, options, cache), schema, Option.fromNullishOr(topTypeName)),
  ) as { readonly [K in keyof Specs]: Schema.Codec<DerivedNodeJSON> };
}
