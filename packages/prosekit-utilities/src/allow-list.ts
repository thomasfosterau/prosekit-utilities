/**
 * Node / mark allow-lists: the narrowing a write seam applies on top of a
 * document's grammar.
 *
 * ## Why an allow-list rather than another compiled schema
 *
 * A document's trust boundary (SEC-XSS-001) is the schema derived from the
 * compiled ProseMirror grammar — one block grammar and one inline grammar,
 * deliberately, so that the editor, the renderer and the column codec never
 * disagree about what a node is. Named surfaces differ only in which subset
 * of that vocabulary they admit: a public comment gets the minimal inline
 * set, an article section gets tables and figures. Those are policy
 * decisions, applied where the surface is known, not separate persistence
 * formats.
 *
 * They are also cheap to apply as a tree-walk and expensive to apply as a
 * schema: the derived schema is `Schema.suspend`-wrapped so the ProseMirror
 * compile stays lazy, and `Schema.check` cannot be appended to a `Suspend`.
 * {@link allowListFilter} is composable onto a `DocumentEnvelope`'s schema
 * (which is not suspended) for that reason; {@link checkAllowList} is the
 * Effect-shaped seam for everything else.
 *
 * Link `href`s are additionally checked against {@link isSafeHref} unless a
 * list opts out — an unsafe scheme is a violation at the write boundary, not
 * merely something the renderer drops later.
 *
 * @module
 */

import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import * as P from 'effect/Predicate';
import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';
import type * as SchemaAST from 'effect/SchemaAST';
import { isSafeHref } from './url-safety.ts';

// ---------------------------------------------------------------------------
// The allow-list itself
// ---------------------------------------------------------------------------

/**
 * One surface's vocabulary: the node and mark type names it admits, whether
 * link `href`s are scheme-checked, and the name used in violation messages.
 *
 * `label` reads as a noun phrase in `node type "x" is not permitted in
 * <label>` — "a comment", "an article section".
 */
export interface AllowList {
  readonly label: string;
  readonly nodes: HashSet.HashSet<string>;
  readonly marks: HashSet.HashSet<string>;
  readonly checkLinkHref: boolean;
}

/**
 * Builds an {@link AllowList} from any iterables of node and mark type
 * names — an array literal, a `Set`, another list's `HashSet`.
 *
 * `checkLinkHref` defaults to `true`: an allow-list that admits the `link`
 * mark is opting into untrusted URLs, and the scheme check is the cheap half
 * of that. Pass `false` only where something else already decides.
 */
export const defineAllowList = (options: {
  readonly label: string;
  readonly nodes: Iterable<string>;
  readonly marks: Iterable<string>;
  readonly checkLinkHref?: boolean;
}): AllowList => ({
  label: options.label,
  nodes: HashSet.fromIterable(options.nodes),
  marks: HashSet.fromIterable(options.marks),
  checkLinkHref: options.checkLinkHref ?? true,
});

// ---------------------------------------------------------------------------
// The violation
// ---------------------------------------------------------------------------

/**
 * The first thing an allow-list walk found outside its vocabulary, as data
 * rather than as a bare string.
 *
 * `kind` says which of the three checks failed and `typeName` says what tripped
 * it (the offending node or mark type), so a caller can map a violation onto
 * its own error envelope without re-parsing `message`. `message` carries the
 * human-readable form both source applications emitted, unchanged, because
 * it is what an API returns to the author.
 */
export class DocumentViolation
  extends /* @__PURE__ */ Schema.TaggedError<
    DocumentViolation,
    { readonly brand: unique symbol }
  >()('DocumentViolation', {
    label: Schema.String,
    kind: /* @__PURE__ */ Schema.Literals(['node', 'mark', 'href']),
    typeName: Schema.String,
    message: Schema.String,
  }) {}

/**
 * A document as the walk needs to see it: anything whose `content` is an
 * array, whatever the element type. A document envelope's `content` is
 * `ReadonlyArray<Json>` at the schema level — a `null` entry gets past the
 * structural check — so the walk below never assumes an entry is an object.
 */
interface WithContent {
  readonly content: ReadonlyArray<WalkEntry>;
}

/**
 * One entry the walk visits: any JSON value. `NodeJSON` and `MarkJSON` are
 * JSON values, and so is whatever a structural check let through in their
 * place.
 */
type WalkEntry = Schema.Json;

/** Whether a JSON value is an object (not an array, not `null`). */
const isJsonObject = (value: Schema.Json): value is Schema.JsonObject =>
  P.isObject(value) && !Arr.isArray(value);

/** Whether a JSON value is an array. */
const isJsonArray = (value: Schema.Json): value is Schema.JsonArray => Arr.isArray(value);

/** A node's `marks` or `content`, when it carries an array there. */
const entriesOf = (node: WalkEntry, key: 'marks' | 'content'): ReadonlyArray<WalkEntry> => {
  if (!isJsonObject(node)) return [];
  const value = node[key];
  return value !== undefined && isJsonArray(value) ? value : [];
};

/**
 * A node's or mark's `type`, or `''` for anything that is not one at all.
 *
 * `''` is in no vocabulary, so a `null`, a stray string or a node missing
 * its `type` reports as a violation rather than throwing halfway through the
 * walk. The walk runs on values a structural check has only proved to be
 * JSON, so that case is reachable.
 */
const typeNameOf = (value: WalkEntry): string =>
  isJsonObject(value) && P.isString(value['type']) ? value['type'] : '';

const nodeViolationOf = (allowList: AllowList, type: string): DocumentViolation =>
  new DocumentViolation({
    label: allowList.label,
    kind: 'node',
    typeName: type,
    message: `node type "${type}" is not permitted in ${allowList.label}`,
  });

const markViolationOf = (allowList: AllowList, type: string): DocumentViolation =>
  new DocumentViolation({
    label: allowList.label,
    kind: 'mark',
    typeName: type,
    message: `mark type "${type}" is not permitted in ${allowList.label}`,
  });

const hrefViolationOf = (allowList: AllowList): DocumentViolation =>
  new DocumentViolation({
    label: allowList.label,
    kind: 'href',
    typeName: 'link',
    message: `link href is not a permitted URL scheme`,
  });

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

/** A mark's string `attrs.href`, or `None` when it carries none. */
const hrefOf = (mark: WalkEntry): Option.Option<string> => {
  if (!isJsonObject(mark)) return Option.none();
  const attrs = mark['attrs'];
  if (attrs === undefined || !isJsonObject(attrs)) return Option.none();
  return Option.liftPredicate(attrs['href'], P.isString);
};

const markViolation =
  (allowList: AllowList) =>
  (mark: WalkEntry): Result.Result<DocumentViolation, void> => {
    const type = typeNameOf(mark);
    if (!HashSet.has(allowList.marks, type)) {
      return Result.succeed(markViolationOf(allowList, type));
    }
    if (
      allowList.checkLinkHref &&
      type === 'link' &&
      !Option.exists(hrefOf(mark), (href) => isSafeHref(href))
    ) {
      return Result.succeed(hrefViolationOf(allowList));
    }
    return Result.failVoid;
  };

const firstMarkViolation = (
  allowList: AllowList,
  node: WalkEntry,
): Option.Option<DocumentViolation> => {
  return Arr.head(Arr.filterMap(entriesOf(node, 'marks'), markViolation(allowList)));
};

const firstViolation = (
  allowList: AllowList,
  nodes: ReadonlyArray<WalkEntry>,
): Option.Option<DocumentViolation> => Arr.head(Arr.filterMap(nodes, nodeViolation(allowList)));

const nodeViolation =
  (allowList: AllowList) =>
  (node: WalkEntry): Result.Result<DocumentViolation, void> => {
    const type = typeNameOf(node);
    if (!HashSet.has(allowList.nodes, type)) {
      return Result.succeed(nodeViolationOf(allowList, type));
    }
    const marks = firstMarkViolation(allowList, node);
    if (Option.isSome(marks)) return Result.succeed(marks.value);
    const nested = firstViolation(allowList, entriesOf(node, 'content'));
    return Option.isNone(nested) ? Result.failVoid : Result.succeed(nested.value);
  };

/**
 * The first node or mark type outside `allowList`'s vocabulary — or the
 * first unsafe `link` `href` — in an already structurally valid document.
 *
 * Depth-first in document order, so the violation names the earliest
 * offender, and `Option.none()` when the whole tree is admissible. The
 * envelope's own `type` is not checked against the node list; only its
 * `content` children are.
 */
export const allowListViolation = (
  allowList: AllowList,
  doc: WithContent,
): Option.Option<DocumentViolation> => firstViolation(allowList, doc.content);

/**
 * The Effect-shaped write seam: succeeds with the document it was given, or
 * fails with the first {@link DocumentViolation}.
 *
 * Curried so an application can name the check once
 * (`const checkComment = checkAllowList(COMMENT)`) and apply it per write,
 * and generic in the document so the value that comes out is the exact type
 * that went in — including a branded or narrowed one.
 */
export const checkAllowList =
  (allowList: AllowList) =>
  <D extends WithContent>(doc: D): Effect.Effect<D, DocumentViolation> =>
    Effect.gen(function* () {
      const violation = allowListViolation(allowList, doc);
      // `DocumentViolation` is a yieldable tagged error; no `Effect.fail` wrapper.
      if (Option.isSome(violation)) return yield* violation.value;
      return doc;
    });

/**
 * The same walk as a `Schema.check`-compatible filter, so an allow-list can
 * be composed onto a schema rather than applied beside it.
 *
 * This is what `DocumentEnvelope.narrow` uses. The failure message is the
 * violation's own `message`, so a decode error reads exactly like the
 * write-seam error for the same document.
 */
export const allowListFilter = (allowList: AllowList): SchemaAST.Filter<WithContent> =>
  Schema.makeFilter(
    (value: WithContent) =>
      Option.match(allowListViolation(allowList, value), {
        onNone: () => true,
        onSome: (violation) => violation.message,
      }),
    {
      identifier: 'documentAllowList',
      title: `${allowList.label} allow-list`,
      description: `Rejects a document carrying a node or mark type outside ${allowList.label}'s vocabulary.`,
    },
  );
