# Document surfaces

How to declare a document surface with `@thomasfosterau/prosekit-utilities`: the browser-cheap envelope, the narrower allow-lists a write seam applies, the server-only derived schema, and the persistence and render call sites that tie them together. Read this first; [Derivation](derivation.md), [Nodes, marks and presets](nodes-and-marks.md), [HTML and Markdown](html-and-markdown.md) and [Drizzle columns](drizzle.md) go deeper on each layer. The API reference is the TSDoc on each export.

## Entry points

| Entry | Holds | Imports ProseKit at runtime |
| --- | --- | --- |
| `.` | Document envelopes, allow-lists, safe URLs, plain-text and reference extraction, the envelope remap, the Markdown serialiser | **Never** |
| `./derive` | The derivation engine: an Effect Schema read back from a compiled ProseMirror schema | Never (`@prosekit/pm` types only) |
| `./prosekit` | Node and mark definitions, the extension presets, `lazySchema`, `defineDocumentSchema`, `installDocumentGrammars`, `createHtmlRenderer` | **Yes** — `prosekit/core`, `prosekit/extensions/*` |
| `./drizzle` | `jsonb` document columns and the SQL twin of text extraction | Never |

## Declaring a document surface

A document surface is declared in layers, each one importing only as much as it needs. The example below threads all four entry points through one `blockDocument` surface that composes an opt-in `mention` node, and a narrower `COMMENT` allow-list applied where comments are written.

```ts
// document-envelopes.ts — browser-reachable, no ProseKit
import { defineDocumentEnvelope } from '@thomasfosterau/prosekit-utilities';

export const blockDocument = defineDocumentEnvelope({ name: 'blockDocument' });
```

```ts
// document-schemas.ts — server-only: the grammar, and the derived wire schema
import { createRegistryCache } from '@thomasfosterau/prosekit-utilities/derive';
import {
  defineBlockDocumentExtension,
  defineDocumentSchema,
  defineMention,
  MENTION_ATTRIBUTE_OVERRIDES,
  mergeAttributeOverrides,
  STANDARD_ATTRIBUTE_OVERRIDES,
} from '@thomasfosterau/prosekit-utilities/prosekit';
import { blockDocument } from './document-envelopes.ts';

// Shared so a second document schema built from an overlapping extension
// derives the marks and `text` node once instead of once per schema, while
// each stays independently lazy. Share it only with a grammar that admits the
// same marks: a grammar with an extra mark (say `defineCitation()`) needs its
// own cache, or the first one forced decides `text`'s marks for both.
const registryCache = createRegistryCache();

export const blockDocumentSchema = defineDocumentSchema(blockDocument, {
  extension: () => defineBlockDocumentExtension(defineMention()),
  attributes: mergeAttributeOverrides(STANDARD_ATTRIBUTE_OVERRIDES, MENTION_ATTRIBUTE_OVERRIDES),
  registryCache,
});
```

```ts
// db/schema/posts.ts — the persistence module: the install site and the column
import { pgTable, uuid } from 'drizzle-orm/pg-core';
import { documentColumn, documentTextSql } from '@thomasfosterau/prosekit-utilities/drizzle';
import { installDocumentGrammars } from '@thomasfosterau/prosekit-utilities/prosekit';
import { blockDocumentSchema } from '../document-schemas.ts';

// Every server runtime loads this module before handling a request, and no
// browser bundle can reach it — the one call site for the whole isolate.
installDocumentGrammars(blockDocumentSchema);

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  body: documentColumn(blockDocumentSchema)('body_jsonb').notNull(),
});

// The SQL twin of `extractDocumentText`, for a generated or materialised column.
export const postSearchText = documentTextSql(posts.body);
```

```ts
// posts.server.ts — rendering HTML in a server load
import { createHtmlRenderer } from '@thomasfosterau/prosekit-utilities/prosekit';
import { blockDocumentSchema } from './document-schemas.ts';

// One renderer per grammar, at module scope — it holds the resolved DOM.
const renderer = createHtmlRenderer({ schema: blockDocumentSchema.schema });

export async function loadPost(id: string) {
  const post = await getPost(id);
  return { post, bodyHtml: await renderer.renderPromise(post.body) };
}
```

```ts
// comments.ts — a narrower allow-list at the write seam
import {
  checkAllowList,
  defineAllowList,
  type DocumentJSON,
} from '@thomasfosterau/prosekit-utilities';
import * as Effect from 'effect/Effect';

const COMMENT = defineAllowList({
  label: 'a comment',
  nodes: ['paragraph', 'text', 'hardBreak'],
  marks: ['bold', 'italic', 'link'],
});
const checkComment = checkAllowList(COMMENT);

export const submitComment = Effect.fn(function* (body: DocumentJSON<'blockDocument'>) {
  yield* checkComment(body); // fails with DocumentViolation
  return yield* persistComment(body);
});
```

A host that runs its own write hooks (a content store's "before write" step, say) applies the same check there. It maps the `DocumentViolation` to its own rejection error with `Effect.mapError`. The violation's `kind`, `name` and `message` say which node, mark or `href` was refused. In the same hook, `extractMentions` and `extractCitations` read what the document references, for a backlink or notification index kept in step with the write:

```ts
import { extractCitations, extractMentions } from '@thomasfosterau/prosekit-utilities';

const mentioned = extractMentions(body).map((mention) => mention.id); // first-mention order, each id once
const cited = extractCitations(body); // the `citation` marks' workIds, each once
```

## The ProseKit-free root entry

```ts
import { defineDocumentEnvelope, defineAllowList } from '@thomasfosterau/prosekit-utilities';
```

Document envelopes, allow-lists, safe URLs, plain-text and reference extraction, the envelope remap and the Markdown serialiser. `effect` is the only dependency, and nothing here imports `prosekit` or `@prosekit/pm`, not even a type. Signatures are in the exports' TSDoc; this is the map, with the behaviour worth knowing before you call them.

| Export | Notes |
| --- | --- |
| `NodeJSON` | A structural twin of `prosekit/core`'s `NodeJSON`, restated so this entry needs no ProseKit type import. |
| `MarkJSON` |  |
| `DocumentJSON<Name>` | The persisted envelope. `Name` defaults to `string`. |
| `DocumentGrammarGuard` | What `./prosekit`'s `DocumentSchema.is` provides, and what `DocumentEnvelope.install` accepts. |
| `defineDocumentEnvelope` | One closure per envelope, so two envelopes never share an install. `label` defaults to the name split into words (`blockDocument` → `block document`). |
| `DocumentEnvelope<Name>` | `Schema` checks the envelope's `type` and that `content` is an array of JSON — deliberately shallow, upgraded by `install` to the full grammar for the isolate's life. `is` keeps a try/catch defect net. |
| `AllowList` | One write surface's vocabulary. |
| `defineAllowList` | Any iterable of type names. `checkLinkHref` defaults to `true`. |
| `DocumentViolation` | The three violation forms as data. Yieldable in an `Effect.gen`. |
| `allowListViolation` | Depth-first, document order, first offender. The envelope's own `type` is not checked — only its `content`. |
| `checkAllowList` | The Effect-shaped write seam. Curried so an app names the check once and applies it per write. |
| `allowListFilter` | The same walk as a `Schema.check`-compatible filter. What `DocumentEnvelope.narrow` uses; exported so it composes onto any schema carrying `content`. |
| `isSafeHref` | Default schemes `http`, `https`, `mailto`; root-relative paths and fragment links always allowed. Parses with `URL` rather than a string prefix, so obfuscated schemes (`JaVaScRiPt:`, leading whitespace) are rejected. |
| `DEFAULT_SAFE_SCHEMES` | `['http', 'https', 'mailto']`. |
| `extractDocumentText` | Default separator `' '`. Tolerant of a missing `content` and of non-object entries — a malformed row degrades to empty text rather than throwing. For a column that may be absent, `Option.fromNullishOr(row.body).pipe(Option.map(extractDocumentText))`. |
| `inlineDocumentText` | The `''` join, so a title never gains a space its author did not type. |
| `extractMentions` | The `mention` nodes' `{ id, label }`, one per distinct `id`, in first-mention order; the first occurrence's `label` wins. Tolerant like `extractDocumentText`; a mention with an empty or non-string `id` (an unresolved one) is skipped. |
| `DocumentMention` | One mentioned entity, as the `mention` node stores it. |
| `extractCitations` | The `citation` marks' `workId`s, one per distinct id, in first-citation order. Tolerant in the same way; an empty or non-string `workId` is skipped. |
| `toEditorDocument` | Envelope `name` → `doc`. Returns a new object. |
| `fromEditorDocument` | `doc` → envelope. A document with no `content` becomes an empty one. Returns a new object. |
| `createMarkdownSerialiser` | The stock cases (paragraph, heading, blockquote, code block, horizontal rule, image, table, the flat-list model, hard break, five marks) are built in; the option maps merge **over** them. |
| `MarkdownSerialiser` | `document` is trimmed multi-line Markdown; `inline` is a trimmed single line. |
| `MarkdownContext` | Handed to every block/inline serialiser so it renders its children exactly as the stock cases do. |
| `BlockSerialiser` | Return `''` to drop the block. |
| `InlineSerialiser` | Return `''` to contribute nothing. |
| `MarkSerialiser` | Wraps already-rendered text in the mark's syntax. |
| `toMarkdown` | The default instance: the shared base grammar and nothing else. |
| `mentionMarkdown` | A mention as its escaped `@label`; the id has no Markdown form. |
| `figureMarkdown` | The image line followed by the caption as an italic paragraph. |
| `sidenoteMarkdown` | The Pandoc inline footnote form, `^[…]`. A nested sidenote is flattened to its body first. |
| `escapeMarkdown` | Backslash-escapes the CommonMark inline metacharacters. Exported for an app's own serialisers. |

### Declaring and narrowing an envelope

An envelope costs nothing to import — no ProseKit, no compiled ProseMirror schema — and is shared by the model layer, the persistence layer and the editor.

```ts
import { defineAllowList, defineDocumentEnvelope } from '@thomasfosterau/prosekit-utilities';

export const blockDocument = defineDocumentEnvelope({ name: 'blockDocument' });
blockDocument.empty(); // { type: 'blockDocument', content: [] }

export const COMMENT = defineAllowList({
  label: 'a comment',
  nodes: ['paragraph', 'text', 'hardBreak'],
  marks: ['bold', 'italic', 'strike', 'code', 'link'],
});

// Decode-time rejection: the allow-list composed onto the envelope's codec.
const CommentBody = blockDocument.narrow(COMMENT);
Schema.decodeUnknownSync(CommentBody)(untrusted);
// → 'node type "heading" is not permitted in a comment'
```

### Checking a write

```ts
import { checkAllowList } from '@thomasfosterau/prosekit-utilities';

const checkComment = checkAllowList(COMMENT);

checkComment(body).pipe(
  Effect.catchTag('DocumentViolation', (violation) =>
    Effect.succeed({ field: 'body', kind: violation.kind, detail: violation.message }),
  ),
);
```

Markdown and HTML serialisation are in [HTML and Markdown](html-and-markdown.md).

### The envelope remap

A persisted document's root `type` is the surface's own name; a compiled ProseMirror schema's top node is always `doc`. Feeding the stored envelope straight into an editor throws `RangeError: Unknown node type: blockDocument`.

```ts
import { fromEditorDocument, toEditorDocument } from '@thomasfosterau/prosekit-utilities';

const forEditor = toEditorDocument(stored); // { type: 'doc', … }
const forStore = fromEditorDocument('blockDocument')(forEditor);
```

## Wire compatibility

**The derivation is the contract.** `./derive` reads node and mark names, groups, the content model and admissible marks off the compiled ProseMirror schema; `./prosekit`'s node and mark specs and `STANDARD_ATTRIBUTE_OVERRIDES` decide the rest. Stored documents are content-addressed and immutable in the consuming apps, so a change to any of these — a spec's shape, an attribute override, which marks a node admits — changes what already-stored rows decode as. This workspace pins `prosemirror-model`/`prosemirror-view` exactly for the same reason.

**The envelope is not versioned.** There is no `version` field on `DocumentJSON` and no normalisation or migration hook: this library decodes exactly what the current derivation accepts, nothing more permissive. A grammar change that needs already-stored rows to keep decoding is a **major** release, not a runtime compatibility shim.

**The golden-fixture suite is the proof.** `tests/prosekit/document-models.test.ts` pins the wire shape of every node and mark this library defines, so a change that would silently alter what a stored document decodes as fails a test rather than shipping quietly.
