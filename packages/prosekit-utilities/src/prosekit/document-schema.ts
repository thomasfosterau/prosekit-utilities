/**
 * The document wire schema, derived from the editor's own ProseMirror schema.
 *
 * ## What a document schema is for
 *
 * One `DocumentSchema` is a single Effect Schema doing both jobs a document
 * contract has to do:
 *
 * - The persistence and `{@html}`-render **trust boundary**. A jsonb document
 *   column (`@thomasfosterau/prosekit-utilities/drizzle`) decodes and encodes
 *   through `Document` on every read and write, and that is the first half of
 *   the SEC-XSS-001 defence in the source applications — the HTML serialiser's
 *   attribute escaping and link allow-list (`./html.ts`) is the second.
 * - The **generative contract** for whole-document machine emission (agentic
 *   editing, a re-validation guard around a translation service), and the
 *   source for a JSON Schema via `Schema.toJsonSchemaDocument`.
 *
 * ## Where the grammar comes from
 *
 * Node and mark names, groups, the content model — including each node's
 * `+`/`*` non-emptiness and any by-name content restriction, such as the
 * sidenote's `(text | hardBreak)*` — and the admissible marks are read
 * straight off the compiled ProseMirror schema by the `Registry` in
 * `@thomasfosterau/prosekit-utilities/derive`, which walks the compiled
 * `ContentMatch` automaton. There is no hand-transcribed grammar to drift out
 * of sync with the live editor. Attribute value types, which ProseMirror
 * cannot expose, come from the attribute overlay — see
 * `./attribute-overrides.ts`.
 *
 * ## The two halves
 *
 * A `DocumentShape` (the root entry) is the browser-cheap half: it names the
 * surface and checks the envelope structurally, with no ProseKit import.
 * `defineDocumentSchema(shape, …)` is the server half, and `install()` is what
 * joins them — from then on the shape rejects exactly what the derived schema
 * rejects, for the life of the isolate.
 *
 * @module
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import type { Extension } from 'prosekit/core';
import type { Schema as PmSchema } from '@prosekit/pm/model';
import {
  attributeOverlay,
  createRegistryCache,
  Registry,
  type RegistryCache,
} from '../derive/index.ts';
import type { DocumentShape } from '../document-shape.ts';
import type { DocumentJSON } from '../json.ts';
import { STANDARD_ATTRIBUTE_OVERRIDES, type AttributeOverrides } from './attribute-overrides.ts';
import { lazySchema } from './lazy-schema.ts';

/**
 * A decode that failed, as a tagged error rather than a thrown
 * `SchemaError` — for a caller that wants the failure in an `Effect` channel
 * it can catch by tag.
 *
 * `document` is the shape's name, so one handler can tell a rejected title
 * from a rejected body. `issue` is the underlying `SchemaError` carried
 * through `Schema.Defect()`, which is JSON-encodable, so the error survives a
 * wire hop to a client or a log sink.
 */
export class DocumentDecodeError extends Schema.TaggedError<DocumentDecodeError>()(
  'DocumentDecodeError',
  {
    document: Schema.String,
    issue: Schema.Defect(),
  },
) {}

/** How {@link defineDocumentSchema} builds a document schema. */
export interface DocumentSchemaOptions {
  /**
   * The grammar, as a factory. Called at most once, the first time a document
   * is actually validated — see {@link DocumentSchema.schema}.
   */
  readonly extension: () => Extension;
  /**
   * The attribute overlay. Defaults to `STANDARD_ATTRIBUTE_OVERRIDES`; an
   * application with opt-in nodes passes
   * `mergeAttributeOverrides(STANDARD_ATTRIBUTE_OVERRIDES, …)`.
   */
  readonly attributes?: AttributeOverrides | undefined;
  /**
   * A `RegistryCache` to share with other document schemas built from
   * overlapping extensions — see {@link defineDocumentSchema}. Defaults to a
   * cache private to this schema.
   */
  readonly registryCache?: RegistryCache | undefined;
}

/** One document surface's ProseKit half: the grammar, the wire schema and the guard. */
export interface DocumentSchema<Name extends string> {
  /** The shape this schema was declared against, and which {@link install} upgrades. */
  readonly shape: DocumentShape<Name>;
  /** The grammar factory, as passed in. */
  readonly extension: () => Extension;
  /** The compiled ProseMirror schema, built on first use and cached (see `lazySchema`). */
  readonly schema: () => PmSchema;
  /** The derived wire schema: the envelope, with `shape.name` in place of ProseMirror's `doc`. */
  readonly Document: Schema.Codec<DocumentJSON<Name>>;
  /** A whole-document type guard over {@link Document}, with a defect net. */
  readonly is: (value: unknown) => value is DocumentJSON<Name>;
  /** {@link Document}'s decode in an `Effect`, failing with a {@link DocumentDecodeError}. */
  readonly decode: (value: unknown) => Effect.Effect<DocumentJSON<Name>, DocumentDecodeError>;
  /** Installs {@link is} as {@link shape}'s grammar guard, for the life of the isolate. */
  readonly install: () => void;
}

/**
 * Declares the ProseKit half of a document surface.
 *
 * ```ts
 * const blockDocument = defineDocumentShape({ name: 'blockDocument' });   // root entry
 * const cache = createRegistryCache();                                    // ./derive
 *
 * export const blockDocumentSchema = defineDocumentSchema(blockDocument, {
 *   extension: () => defineBlockDocumentExtension(defineMention()),
 *   attributes: mergeAttributeOverrides(STANDARD_ATTRIBUTE_OVERRIDES, MENTION_ATTRIBUTE_OVERRIDES),
 *   registryCache: cache,
 * });
 * ```
 *
 * ## Lazy, all the way down
 *
 * Nothing here compiles or derives anything at declaration time.
 * {@link DocumentSchema.schema} is a `lazySchema` thunk, and `Document` is
 * wrapped in `Schema.suspend`, which defers its body until the schema is first
 * used and memoises it thereafter. So importing the module that declares a
 * document surface — as a model layer or a route module does — never pays for
 * a ProseMirror compile or for building the derived Effect Schema graph unless
 * a document is actually validated (PERF-CPU-001 in the source applications).
 *
 * ## Sharing derivation without coupling
 *
 * Two document schemas built from overlapping extensions — a block grammar and
 * an inline grammar both composing `defineStandardMarks()` and `defineText()` —
 * derive the same mark schemas and the same `text` node schema. Passing both
 * the same `registryCache` means whichever is forced *first* builds that shared
 * structure and the other reuses it.
 *
 * They nonetheless stay **independently lazy and independent failure
 * domains**: validating one never forces compiling or deriving the other, and
 * a defect in one's derivation cannot break the other. That is why this is not
 * `deriveDocumentSchemas`, which batches N schemas in one eager call — it would
 * force compiling every grammar up front and couple their failure domains, for
 * exactly the same sharing benefit this gets without either cost.
 *
 * Sharing a cache is only correct when the same-named types across the two
 * grammars are structurally identical — true by construction when both are
 * assembled from the same extension definitions, which is the only case this
 * targets.
 */
export function defineDocumentSchema<Name extends string>(
  shape: DocumentShape<Name>,
  options: DocumentSchemaOptions,
): DocumentSchema<Name> {
  const schema = lazySchema(options.extension);
  const overlay = attributeOverlay(options.attributes ?? STANDARD_ATTRIBUTE_OVERRIDES);

  // A caller-supplied cache is shared; the fallback is private to this schema
  // and, like everything else here, created on first derivation rather than at
  // declaration time.
  const shared = options.registryCache;
  let own: Option.Option<RegistryCache> = Option.none();
  const cacheFor = (): RegistryCache => {
    if (shared !== undefined) return shared;
    if (Option.isSome(own)) return own.value;
    const created = createRegistryCache();
    own = Option.some(created);
    return created;
  };

  const Document = Schema.suspend(() => {
    const compiled = schema();
    const registry = new Registry(compiled, { attributes: overlay }, cacheFor());
    // The top node is renamed here and only here: ProseMirror's top node is
    // always `doc`, and the envelope's `type` is the surface's own name.
    return registry.nodeAs(compiled.topNodeType, shape.name);
    // The derived schema's inferred type is a wider structural type than
    // `DocumentJSON<Name>` (its nodes are `DerivedNodeJSON`, and its top
    // `type` is `string`, not the literal). This is the single documented seam
    // where it is pinned to the declared shape — the same convention the
    // `Registry` itself uses internally.
  }) as unknown as Schema.Codec<DocumentJSON<Name>>;

  const guard = Schema.is(Document);
  const decodeUnknown = Schema.decodeUnknownEffect(Document);

  return {
    shape,
    extension: options.extension,
    schema,
    Document,
    /*
     * `Schema.is` returns `false` for ordinary schema issues, but a genuine
     * defect — a pathologically deep `content` nesting exhausting the call
     * stack while walking the recursive struct/union graph — propagates as a
     * raw exception instead. Catching it degrades a
     * malformed-but-not-cleanly-rejectable document to "not a valid document"
     * rather than an uncaught throw on a render path.
     */
    is: (value: unknown): value is DocumentJSON<Name> => {
      try {
        return guard(value);
      } catch {
        return false;
      }
    },
    decode: (value: unknown) =>
      Effect.mapError(
        decodeUnknown(value),
        (issue) => new DocumentDecodeError({ document: shape.name, issue }),
      ),
    install: () => {
      shape.install((value: unknown) => guard(value));
    },
  };
}

/**
 * Installs every schema's grammar guard onto its shape — the persistence
 * layer's one call.
 *
 * ```ts
 * installDocumentGrammars(blockDocumentSchema, inlineDocumentSchema);
 * ```
 *
 * Put it at module scope in the module a server runtime loads before handling
 * a request and no browser bundle can reach (the one that declares the
 * document columns). Installing is cheap — it stores a function reference and
 * forces nothing — and every shape stays permissive until it happens, so a
 * runtime that never installs under-checks rather than wrongly rejects.
 */
export const installDocumentGrammars = (
  ...schemas: ReadonlyArray<DocumentSchema<string>>
): void => {
  for (const schema of schemas) schema.install();
};
