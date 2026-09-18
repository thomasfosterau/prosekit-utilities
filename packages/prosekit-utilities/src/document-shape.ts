/**
 * Document shapes: the ProseKit-free view onto a document wire schema.
 *
 * ## Why this module exists
 *
 * A schema derived from a compiled ProseMirror grammar (the ProseKit entry point's
 * `defineDocumentSchema`) has to import the editor runtime — `createEditor`
 * and the whole node / mark registry — to exist at all. A model layer that
 * declares a document-valued attribute is genuinely browser-reachable (API
 * clients, form components), so declaring it with the derived schema
 * statically bundles the editor, the single largest client chunk, into every
 * page including anonymous read-only ones.
 *
 * ## What a shape does instead
 *
 * A {@link DocumentShape} validates the ProseMirror JSON tree
 * **structurally** — the top-level `type`, and that `content` is an array of
 * JSON — with no ProseKit import at all. On top of that sits a pluggable
 * grammar check: a server runtime calls {@link DocumentShape.install} once
 * (the ProseKit entry point's `installDocumentGrammars` does it for a whole set), and
 * from then on the shape rejects exactly what the derived schema rejects.
 *
 * The structural check is a strict superset of the grammar check — anything
 * the compiled ProseMirror schema accepts passes it — so an uninstalled
 * runtime is permissive, never spuriously rejecting. That direction matters:
 * a client that wrongly rejected a valid document would break authoring,
 * whereas a client that wrongly accepts an invalid one is caught by the
 * server that actually decides. SEC-XSS-001's trust boundary is unchanged on
 * the server, and the browser — which is not a trust boundary — gets the
 * structural check alone.
 *
 * @module
 */

import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import type { AllowList } from './allow-list.ts';
import { allowListFilter } from './allow-list.ts';
import type { DocumentJSON } from './json.ts';

/**
 * A whole-document type guard — what the ProseKit entry point's `DocumentSchema.is`
 * provides and what {@link DocumentShape.install} accepts.
 */
export type DocumentGrammarGuard = (value: unknown) => boolean;

/**
 * The document's `content`: an array of ProseMirror node JSON, checked only
 * as far as "it is JSON".
 *
 * **Deliberately shallow, and measured.** An earlier version of this check
 * walked the node graph structurally — `type` / `attrs` / `marks` /
 * `content` / `text` per node, recursively. That is redundant work on a
 * server, where the installed grammar guard already checks strictly more
 * than any structural walk can, and near-worthless in a browser, which
 * validates documents the server produced rather than untrusted input. It
 * was not free: on a 20-paragraph document the deep walk cost 0.157 ms
 * against the grammar check's own 0.141 ms — a 1.76x decode, per document,
 * on a path an API runs per row. Flattening to `Schema.Json` takes the
 * structural walk to 0.039 ms (1.26x), and costs the browser only per-node
 * shape errors it was never the right place to catch.
 *
 * `Schema.Json` rather than `Schema.Unknown` because an open leaf here would
 * put a fresh `Unknown` inside the response schema of every endpoint
 * carrying a document attribute, which a wire contract that forbids
 * structurally open response schemas (JSONAPI-WIRE-001 in the source
 * applications) rejects without explicit coercion. `Schema.Json` is closed
 * and JSON-safe by construction — and a non-JSON value (a `Date`, a
 * function) is still rejected rather than waved through.
 */
const ContentShape = Schema.Array(Schema.Json);

/**
 * Splits a camel-case shape name into the words a violation message reads
 * with: `blockDocument` → `block document`.
 */
const wordsOf = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();

/**
 * One document surface, declared once and shared by the model layer, the
 * persistence layer and the editor.
 *
 * `Schema` is the browser-cheap codec; `narrow` composes an allow-list onto
 * it; `install` upgrades every one of them, for the life of the isolate, to
 * the full grammar check.
 */
export interface DocumentShape<Name extends string> {
  /** The envelope's top-level `type` — `blockDocument`, `inlineDocument`, … */
  readonly name: Name;
  /** The human-readable noun phrase used in validation messages. */
  readonly label: string;
  /** The structural codec, grammar-checked wherever {@link install} has run. */
  readonly Schema: Schema.Codec<DocumentJSON<Name>>;
  /** `Schema.is` over {@link Schema}, with a defect net — see below. */
  readonly is: (value: unknown) => value is DocumentJSON<Name>;
  /** Installs the grammar guard for the life of the isolate. Idempotent in effect. */
  readonly install: (guard: DocumentGrammarGuard) => void;
  /** Whether a grammar guard is installed. For tests; production code should not branch on it. */
  readonly isInstalled: () => boolean;
  /** An empty document of this shape — the value a fresh editor field starts from. */
  readonly empty: () => DocumentJSON<Name>;
  /** {@link Schema} with an allow-list filter appended. */
  readonly narrow: (allowList: AllowList) => Schema.Codec<DocumentJSON<Name>>;
}

/**
 * Declares a document surface.
 *
 * ```ts
 * const blockDocument = defineDocumentShape({ name: 'blockDocument' });
 * ```
 *
 * Each call gets its own guard slot, so two shapes never share an install.
 * `label` defaults to the name split into words (`blockDocument` → `block
 * document`), which is what the validation message reads with: `must be a
 * valid block document`.
 */
export function defineDocumentShape<Name extends string>(options: {
  readonly name: Name;
  readonly label?: string | undefined;
}): DocumentShape<Name> {
  const name = options.name;
  const label = options.label ?? wordsOf(name);

  let grammar: Option.Option<DocumentGrammarGuard> = Option.none();

  const documentSchema = Schema.Struct({
    type: Schema.Literal(name),
    content: ContentShape,
  }).pipe(
    Schema.check(
      Schema.makeFilter(
        (value) => {
          // The guard is read at validation time, not at construction time,
          // so the install order between this module and whichever module
          // owns the compiled grammar does not matter — only that the
          // install happens before the first document is validated, which
          // module-scope loading guarantees.
          const check = grammar;
          return Option.isNone(check) || check.value(value) ? true : `must be a valid ${label}`;
        },
        {
          identifier: `${name}Grammar`,
          title: `${label} grammar`,
          description: `Rejects a structurally valid ProseMirror tree that the installed ${label} grammar does not accept.`,
        },
      ),
    ),
    // The derived struct schema's inferred type is a wider structural type
    // than `DocumentJSON<Name>` (its `content` is `ReadonlyArray<Json>`, not
    // `ReadonlyArray<NodeJSON>`). This is the single documented seam where
    // it is pinned to the declared shape.
  ) as unknown as Schema.Codec<DocumentJSON<Name>>;

  const guard = Schema.is(documentSchema);

  return {
    name,
    label,
    Schema: documentSchema,
    /*
     * `Schema.is` only returns `false` for ordinary schema issues; a genuine
     * defect (a pathologically deep `content` nesting exhausting the call
     * stack while an installed guard walks the recursive struct/union graph)
     * propagates as a raw exception instead. Catching it degrades a
     * malformed-but-not-cleanly-rejectable document to "not a valid
     * document" rather than an uncaught throw on a render path.
     */
    is: (value: unknown): value is DocumentJSON<Name> => {
      try {
        return guard(value);
      } catch {
        return false;
      }
    },
    install: (installed: DocumentGrammarGuard) => {
      grammar = Option.some(installed);
    },
    isInstalled: () => Option.isSome(grammar),
    empty: () => ({ type: name, content: [] }),
    narrow: (allowList: AllowList) => documentSchema.pipe(Schema.check(allowListFilter(allowList))),
  };
}
