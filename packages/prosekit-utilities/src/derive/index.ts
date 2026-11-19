/**
 * `@thomasfosterau/prosekit-utilities/derive`: an Effect Schema derived from a
 * ProseKit / ProseMirror node, mark or document schema. Imports ProseKit types
 * only.
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
