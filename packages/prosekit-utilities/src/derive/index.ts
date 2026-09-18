/**
 * `@thomasfosterau/prosekit-utilities/derive` — derive an Effect Schema from a
 * ProseKit / ProseMirror node, mark, or document schema.
 *
 * The editor already knows the shape of its documents; this package reads that
 * shape out of the live schema at runtime and hands back an Effect Schema —
 * node and mark names, groups, the content model, and admissible marks
 * recovered exactly, with attributes recovered best-effort and a caller
 * {@link Options.AttributeOverlay} seam for the value types ProseMirror does
 * not expose. The derived schema complements, rather than replaces, a
 * hand-written generative document contract, which still owns the attribute
 * value types.
 *
 * ```ts
 * import { createEditor } from "prosekit/core";
 * import { deriveDocumentSchema } from "@thomasfosterau/prosekit-utilities/derive";
 * import * as Schema from "effect/Schema";
 *
 * const { schema } = createEditor({ extension });
 * const Document = deriveDocumentSchema(schema, { topTypeName: "blockDocument" });
 * const doc = Schema.decodeUnknownSync(Document)(json);
 * ```
 *
 * The four entry points ({@link Derive.deriveNodeSchema},
 * {@link Derive.deriveMarkSchema}, {@link Derive.deriveDocumentSchema},
 * {@link Derive.deriveDocumentSchemas}) are re-exported at the top level for
 * convenience; the lower-level modules are exposed as Effect-style
 * namespaces.
 *
 * @module @thomasfosterau/prosekit-utilities/derive
 */

export {
  deriveDocumentSchema,
  deriveDocumentSchemas,
  deriveMarkSchema,
  deriveNodeSchema,
} from './Derive.ts';
export type { DocumentSchemaSpec } from './Derive.ts';
export { attributeOverlay, isRequiredAttribute, required } from './Options.ts';
export type {
  AttributeOverlay,
  AttributeOwner,
  DeriveDocumentOptions,
  DeriveOptions,
  DerivedMarkJSON,
  DerivedNodeJSON,
  RequiredAttribute,
} from './Options.ts';

export * as Attribute from './Attribute.ts';
export * as Content from './Content.ts';
export * as Derive from './Derive.ts';
export * as Options from './Options.ts';
export { createRegistryCache, Registry } from './Registry.ts';
export type { RegistryCache } from './Registry.ts';
