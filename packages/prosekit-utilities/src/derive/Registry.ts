/**
 * @copyright Thomas Foster
 *
 * The derivation engine: a memoised builder that turns one ProseMirror
 * {@link PmSchema} plus a set of {@link DeriveOptions} into Effect schemas for
 * its marks and (mutually recursive) nodes.
 *
 * Nodes reference each other through their content models, so the node
 * schemas form a mutually recursive graph. The graph is expressed with
 * `Schema.suspend`: a node's content field holds a union of *deferred*
 * references to its admissible child schemas, and each reference resolves
 * through {@link Registry.node}, which memoises so the graph is built once and
 * cycles terminate. `suspend` also keeps construction lazy — building one node
 * never forces its children — so declaration order is irrelevant and recursive
 * grammars (a list inside a list) are fine.
 *
 * A {@link Registry} is internal plumbing; the public entry points in
 * `./Derive` create one and read a single schema out of it. Several
 * `Registry` instances — one per ProseMirror schema — can share a single
 * {@link RegistryCache} so structure the schemas have in common (e.g. two
 * ProseKit extensions both composing the same `defineAllMarks()`) is built
 * once rather than once per schema; {@link import("./Derive.ts").deriveDocumentSchemas}
 * is the public entry point that does this. Memoization is by mark/node
 * *name*, so sharing a cache across schemas is only correct when same-named
 * types across those schemas are structurally identical — true by
 * construction when the schemas are assembled from the same extension
 * definitions, which is the only scenario `deriveDocumentSchemas` targets.
 *
 * That includes the **mark set**. An inline node's derived `marks` field is
 * the schema-wide union of inline marks (see `#inlineMarks`), so two schemas
 * that both define `text` identically but admit different marks still derive
 * different `text` schemas, and the cache keeps whichever was built first. A
 * schema with an extra mark that is derived first makes the other accept that
 * mark; derived second, it rejects its own mark. Nothing reports the clash.
 *
 * @module @thomasfosterau/prosekit-utilities/derive/Registry
 */

import * as Array from 'effect/Array';
import * as Option from 'effect/Option';
import * as Record from 'effect/Record';
import * as Schema from 'effect/Schema';
import type { MarkType, NodeType, Schema as PmSchema } from '@prosekit/pm/model';
import { deriveAttrsStruct } from './Attribute.ts';
import { allowedContentTypes, contentCardinality } from './Content.ts';
import type { DeriveOptions, DerivedMarkJSON, DerivedNodeJSON } from './Options.ts';

/**
 * The memoised mark/node maps a {@link Registry} reads and writes.
 *
 * Keys are type names. Share one cache only between schemas whose mark sets
 * match and whose same-named types are defined identically; see the module
 * doc for what goes wrong otherwise.
 */
export interface RegistryCache {
  readonly nodeCache: Map<string, Schema.Codec<DerivedNodeJSON>>;
  readonly markCache: Map<string, Schema.Codec<DerivedMarkJSON>>;
}

/** A fresh, empty {@link RegistryCache} — private to one `Registry` unless explicitly shared. */
export function createRegistryCache(): RegistryCache {
  // oxlint-disable-next-line effect/avoid-native-object-helpers -- `RegistryCache`'s exported shape; the caches are mutated in place through `readonly` fields, which an immutable `HashMap` cannot express
  return { nodeCache: new Map(), markCache: new Map() };
}

/** Builds and memoises the derived schemas for a single ProseMirror schema. */
export class Registry {
  readonly #schema: PmSchema;
  readonly #options: DeriveOptions;
  readonly #cache: RegistryCache;

  constructor(
    schema: PmSchema,
    options: DeriveOptions = {},
    cache: RegistryCache = createRegistryCache(),
  ) {
    this.#schema = schema;
    this.#options = options;
    this.#cache = cache;
  }

  /** The derived schema for a mark type, built once and memoised by name. */
  mark(markType: MarkType): Schema.Codec<DerivedMarkJSON> {
    const cached = this.#cache.markCache.get(markType.name);
    if (cached) return cached;
    const built = this.#buildMark(markType);
    this.#cache.markCache.set(markType.name, built);
    return built;
  }

  /** The derived schema for a node type, built once and memoised by name. */
  node(nodeType: NodeType): Schema.Codec<DerivedNodeJSON> {
    const cached = this.#cache.nodeCache.get(nodeType.name);
    if (cached) return cached;
    const built = this.#buildNode(nodeType, nodeType.name);
    this.#cache.nodeCache.set(nodeType.name, built);
    return built;
  }

  /**
   * The derived schema for a node type with its `type` literal overridden —
   * used for a renamed top node (e.g. `doc` → `blockDocument`). Not memoised,
   * since the override makes it distinct from the canonical node schema.
   */
  nodeAs(nodeType: NodeType, typeName: string): Schema.Codec<DerivedNodeJSON> {
    return this.#buildNode(nodeType, typeName);
  }

  #buildMark(markType: MarkType): Schema.Codec<DerivedMarkJSON> {
    const fields: Record<string, Schema.Top> = {
      type: Schema.Literal(markType.name),
    };
    const attrs = deriveAttrsStruct(
      { kind: 'mark', name: markType.name },
      // ProseMirror leaves `spec.attrs` absent for an attribute-less mark;
      // convert that foreign `undefined` here, at the boundary.
      Option.fromNullishOr(markType.spec.attrs),
      this.#options.attributes,
    );
    if (Option.isSome(attrs)) fields.attrs = attrs.value;
    const struct: Schema.Top = Schema.Struct(fields);
    // SAFETY: the runtime shape is `{ type, attrs? }` by construction above.
    // A struct built from a runtime-computed field record has no static
    // relation to `DerivedMarkJSON` (there is nothing to decode here), so the
    // documented shape is asserted at this single seam, from `Schema.Top`.
    return struct as Schema.Codec<DerivedMarkJSON>;
  }

  #inlineMarkCache: Option.Option<ReadonlyArray<MarkType>> = Option.none();

  /**
   * The marks admissible on inline content anywhere in the schema.
   *
   * In ProseMirror JSON marks are serialised on the inline nodes, but the
   * *permission* to carry a mark comes from the containing textblock's
   * `markSet` (a node's own `markSet` — `text`'s included — governs what it may
   * hold, and a textblock's governs its inline children). Rather than thread
   * parent context through the memoised node graph, we take the schema-wide
   * union: a mark that some textblock (`inlineContent`) admits may appear on
   * inline nodes. A `null` `markSet` on any textblock means all marks.
   */
  #inlineMarks(): ReadonlyArray<MarkType> {
    if (Option.isSome(this.#inlineMarkCache)) return this.#inlineMarkCache.value;
    const inlineNodes = Array.filter(
      Record.values(this.#schema.nodes),
      (node) => node.inlineContent,
    );
    // A `null` `markSet` on any textblock means all marks.
    if (Array.some(inlineNodes, (node) => node.markSet === null)) {
      const all = Record.values(this.#schema.marks);
      this.#inlineMarkCache = Option.some(all);
      return all;
    }
    // Dedupe by name, keeping first-discovery order — same-named marks within
    // one ProseMirror schema are the same `MarkType` instance.
    const deduped = Array.dedupeWith(
      Array.flatMap(inlineNodes, (node) => node.markSet ?? []),
      (a: MarkType, b: MarkType) => a.name === b.name,
    );
    this.#inlineMarkCache = Option.some(deduped);
    return deduped;
  }

  /** The union of mark schemas a node may carry in JSON, or `Option.none()`. */
  #marksFor(nodeType: NodeType): Option.Option<Schema.Top> {
    if (this.#options.includeMarks === false) return Option.none();
    // Marks serialise on inline nodes only; block nodes carry none.
    if (!nodeType.isInline) return Option.none();
    const markTypes = this.#inlineMarks();
    if (!Array.isReadonlyArrayNonEmpty(markTypes)) return Option.none();
    const members = Array.map(markTypes, (m) => this.mark(m));
    return Option.some(members.length === 1 ? Array.headNonEmpty(members) : Schema.Union(members));
  }

  /** The content field schema for a node, or `Option.none()` for a leaf. */
  #contentFor(nodeType: NodeType): Option.Option<Schema.Top> {
    const cardinality = contentCardinality(nodeType);
    if (cardinality === 'none') return Option.none();
    const childTypes = allowedContentTypes(nodeType);
    if (!Array.isReadonlyArrayNonEmpty(childTypes)) return Option.none();

    // Reference each admissible child lazily so the mutually recursive node
    // graph terminates and declaration order does not matter.
    const childMembers = Array.map(childTypes, (child): Schema.Codec<DerivedNodeJSON> =>
      Schema.suspend((): Schema.Codec<DerivedNodeJSON> => this.node(child)),
    );
    const child =
      childMembers.length === 1 ? Array.headNonEmpty(childMembers) : Schema.Union(childMembers);

    if (cardinality === 'required' && this.#options.nonEmptyRequiredContent !== false) {
      return Option.some(Schema.NonEmptyArray(child));
    }
    return Option.some(Schema.Array(child));
  }

  #buildNode(nodeType: NodeType, typeName: string): Schema.Codec<DerivedNodeJSON> {
    const fields: Record<string, Schema.Top> = {
      type: Schema.Literal(typeName),
    };

    const attrs = deriveAttrsStruct(
      { kind: 'node', name: nodeType.name },
      // As in `#buildMark`: ProseMirror's own absent-`attrs` `undefined`
      // converts to an `Option` here, at the boundary.
      Option.fromNullishOr(nodeType.spec.attrs),
      this.#options.attributes,
    );
    if (Option.isSome(attrs)) fields.attrs = attrs.value;

    // The text node carries a string payload rather than child content.
    if (nodeType.isText) {
      fields.text = Schema.String;
    } else {
      const content = this.#contentFor(nodeType);
      if (Option.isSome(content)) {
        // Possibly-empty content (`*`) is omitted from the JSON when empty, so
        // the key is optional; required content (`+`) is always present.
        fields.content =
          contentCardinality(nodeType) === 'optional'
            ? Schema.optionalKey(content.value)
            : content.value;
      }
    }

    const marks = this.#marksFor(nodeType);
    if (Option.isSome(marks)) fields.marks = Schema.optionalKey(Schema.Array(marks.value));

    const struct: Schema.Top = Schema.Struct(fields);
    // SAFETY: see the mark seam above — the dynamic struct matches
    // `DerivedNodeJSON` by construction, so assert it here rather than
    // propagate a wider type.
    return struct as Schema.Codec<DerivedNodeJSON>;
  }
}
