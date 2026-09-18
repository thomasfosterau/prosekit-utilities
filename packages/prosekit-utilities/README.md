# @thomasfosterau/prosekit-utilities

A ProseKit document grammar as data: browser-cheap document shapes and node/mark allow-lists, an [Effect Schema](https://effect.website) derived at runtime from a compiled ProseMirror schema, HTML and Markdown serialisation, and Drizzle `jsonb` document columns. Four entry points, split by what they cost to import: `.` and `./drizzle` never touch ProseKit, `./derive` only its types, and `./prosekit` is the one entry that pulls in the editor runtime — so a browser-reachable model layer can name a document type without shipping the editor to every page. Everything but the Svelte packages in this workspace is Effect-first: domain failures are `Schema.TaggedError` values, `Option`/`Result` stand in for `null`/exceptions, and a function that cannot fail stays a plain function.

## Installation

```sh
pnpm add @thomasfosterau/prosekit-utilities effect prosekit @prosekit/pm
```

| Package | Range | Why |
| --- | --- | --- |
| `effect` | `^4.0.0-rc.112` | Required. Every entry point returns or consumes `effect/Schema`, `Option`, `Result` or `Effect` values. |
| `prosekit` | `^0.22.2` | Required by `./prosekit` only. The node/mark definitions, `lazySchema` and `createHtmlRenderer` run the real editor runtime. |
| `@prosekit/pm` | `^0.1.19` | Required by `./prosekit` only (and by `./derive`'s types). ProseMirror's own model, which ProseKit re-exports. |
| `drizzle-orm` | `^1.0.0-rc.5` | Optional. Only `./drizzle` reaches for it. |
| `linkedom` | `^0.18.13` | Optional. Only `./prosekit`'s `createHtmlRenderer` reaches for it, and only when rendering on a server with no global `document` — see [`./prosekit` § HTML](#prosekit-html). |

A consumer that only ever imports the root entry (a browser-reachable model layer, say) needs `effect` alone; `prosekit` and `@prosekit/pm` are declared peers of the package as a whole because `./prosekit` is part of it, but nothing outside that entry imports them.

## Entry points

| Entry | Holds | Imports ProseKit at runtime |
| --- | --- | --- |
| `.` | Document shapes, allow-lists, safe URLs, plain-text extraction, the envelope remap, the Markdown serialiser | **Never** |
| `./derive` | The derivation engine: an Effect Schema read back from a compiled ProseMirror schema | Never (`@prosekit/pm` types only) |
| `./prosekit` | Node and mark definitions, the extension presets, `lazySchema`, `defineDocumentSchema`, `installDocumentGrammars`, `createHtmlRenderer` | **Yes** — `prosekit/core`, `prosekit/extensions/*` |
| `./drizzle` | `jsonb` document columns and the SQL twin of text extraction | Never |

## Declaring a document surface

A document surface is declared in layers, each one importing only as much as it needs. The example below threads all four entry points through one `blockDocument` surface that composes an opt-in `mention` node, and a narrower `COMMENT` allow-list applied where comments are written.

```ts
// document-shapes.ts — browser-reachable, no ProseKit
import { defineDocumentShape } from '@thomasfosterau/prosekit-utilities';

export const blockDocument = defineDocumentShape({ name: 'blockDocument' });
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
import { blockDocument } from './document-shapes.ts';

// Shared so a second document schema built from an overlapping extension
// derives the marks and `text` node once instead of once per schema, while
// each stays independently lazy.
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

---

# `.` — the ProseKit-free surface

```ts
import { defineDocumentShape, defineAllowList } from '@thomasfosterau/prosekit-utilities';
```

Document shapes, allow-lists, safe URLs, plain-text extraction, the envelope remap and the Markdown serialiser — `effect` is the only dependency, and nothing here imports `prosekit` or `@prosekit/pm`, not even a type.

| Export | Signature | Notes |
| --- | --- | --- |
| `NodeJSON` | `interface NodeJSON { readonly type: string; readonly attrs?: Record<string, unknown> \| undefined; readonly content?: ReadonlyArray<NodeJSON> \| undefined; readonly marks?: ReadonlyArray<MarkJSON> \| undefined; readonly text?: string \| undefined }` | A structural twin of `prosekit/core`'s `NodeJSON`, restated so this entry needs no ProseKit type import. |
| `MarkJSON` | `interface MarkJSON { readonly type: string; readonly attrs?: Record<string, unknown> \| undefined }` |  |
| `DocumentJSON<Name>` | `{ readonly type: Name; readonly content: ReadonlyArray<NodeJSON> }` | The persisted envelope. `Name` defaults to `string`. |
| `DocumentGrammarGuard` | `(value: unknown) => boolean` | What `./prosekit`'s `DocumentSchema.is` provides, and what `DocumentShape.install` accepts. |
| `defineDocumentShape` | `<Name extends string>(options: { readonly name: Name; readonly label?: string \| undefined }) => DocumentShape<Name>` | One closure per shape, so two shapes never share an install. `label` defaults to the name split into words (`blockDocument` → `block document`). |
| `DocumentShape<Name>` | `{ readonly name: Name; readonly label: string; readonly Schema: Schema.Codec<DocumentJSON<Name>>; readonly is: (v: unknown) => v is DocumentJSON<Name>; readonly install: (guard: DocumentGrammarGuard) => void; readonly isInstalled: () => boolean; readonly empty: () => DocumentJSON<Name>; readonly narrow: (allowList: AllowList) => Schema.Codec<DocumentJSON<Name>> }` | `Schema` checks the envelope's `type` and that `content` is an array of JSON — deliberately shallow, upgraded by `install` to the full grammar for the isolate's life. `is` keeps a try/catch defect net. |
| `AllowList` | `{ readonly label: string; readonly nodes: HashSet.HashSet<string>; readonly marks: HashSet.HashSet<string>; readonly checkLinkHref: boolean }` | One write surface's vocabulary. |
| `defineAllowList` | `(options: { readonly label: string; readonly nodes: Iterable<string>; readonly marks: Iterable<string>; readonly checkLinkHref?: boolean \| undefined }) => AllowList` | Any iterable of type names. `checkLinkHref` defaults to `true`. |
| `DocumentViolation` | `class DocumentViolation extends Schema.TaggedError<DocumentViolation>()('DocumentViolation', { label: Schema.String, kind: Schema.Literals(['node', 'mark', 'href']), name: Schema.String, message: Schema.String }) {}` | The three violation forms as data. Yieldable in an `Effect.gen`. |
| `allowListViolation` | `(allowList: AllowList, doc: { readonly content: ReadonlyArray<NodeJSON> }) => Option.Option<DocumentViolation>` | Depth-first, document order, first offender. The envelope's own `type` is not checked — only its `content`. |
| `checkAllowList` | `(allowList: AllowList) => <D extends { readonly content: ReadonlyArray<NodeJSON> }>(doc: D) => Effect.Effect<D, DocumentViolation>` | The Effect-shaped write seam. Curried so an app names the check once and applies it per write. |
| `allowListFilter` | `(allowList: AllowList) => SchemaAST.Filter<{ readonly content: ReadonlyArray<unknown> }>` | The same walk as a `Schema.check`-compatible filter. What `DocumentShape.narrow` uses; exported so it composes onto any schema carrying `content`. |
| `isSafeHref` | `(href: unknown, options?: { readonly schemes?: ReadonlyArray<string> \| undefined } \| undefined) => href is string` | Default schemes `http`, `https`, `mailto`; root-relative paths and fragment links always allowed. Parses with `URL` rather than a string prefix, so obfuscated schemes (`JaVaScRiPt:`, leading whitespace) are rejected. |
| `DEFAULT_SAFE_SCHEMES` | `ReadonlyArray<string>` | `['http', 'https', 'mailto']`. |
| `extractDocumentText` | `(doc: NodeJSON \| DocumentJSON \| null \| undefined, options?: { readonly separator?: string \| undefined } \| undefined) => string` | Default separator `' '`. Tolerant of `null`, a missing `content`, and non-object entries — a malformed row degrades to empty text rather than throwing. |
| `inlineDocumentText` | `(doc: NodeJSON \| DocumentJSON) => string` | The `''` join, so a title never gains a space its author did not type. |
| `toEditorDocument` | `<N extends string>(doc: DocumentJSON<N> \| NodeJSON) => NodeJSON` | Envelope `name` → `doc`. Returns a new object. |
| `fromEditorDocument` | `<N extends string>(name: N) => (doc: NodeJSON) => DocumentJSON<N>` | `doc` → envelope. A document with no `content` becomes an empty one. Returns a new object. |
| `createMarkdownSerialiser` | `(options?: { readonly blocks?: Record<string, BlockSerialiser> \| undefined; readonly inlines?: Record<string, InlineSerialiser> \| undefined; readonly marks?: Record<string, MarkSerialiser> \| undefined }) => MarkdownSerialiser` | The stock cases (paragraph, heading, blockquote, code block, horizontal rule, image, table, the flat-list model, hard break, five marks) are built in; the option maps merge **over** them. |
| `MarkdownSerialiser` | `{ readonly document: (doc: NodeJSON \| DocumentJSON) => string; readonly inline: (doc: NodeJSON \| DocumentJSON) => string }` | `document` is trimmed multi-line Markdown; `inline` is a trimmed single line. |
| `MarkdownContext` | `{ readonly serialiseInline: (nodes: ReadonlyArray<NodeJSON>) => string; readonly serialiseBlocks: (nodes: ReadonlyArray<NodeJSON>) => string; readonly escape: (text: string) => string }` | Handed to every block/inline serialiser so it renders its children exactly as the stock cases do. |
| `BlockSerialiser` | `(node: NodeJSON, context: MarkdownContext) => string` | Return `''` to drop the block. |
| `InlineSerialiser` | `(node: NodeJSON, context: MarkdownContext) => string` | Return `''` to contribute nothing. |
| `MarkSerialiser` | `(text: string, mark: MarkJSON) => string` | Wraps already-rendered text in the mark's syntax. |
| `toMarkdown` | `MarkdownSerialiser` | The default instance: the shared base grammar and nothing else. |
| `mentionMarkdown` | `InlineSerialiser` | A mention as its escaped `@label`; the id has no Markdown form. |
| `figureMarkdown` | `BlockSerialiser` | The image line followed by the caption as an italic paragraph. |
| `sidenoteMarkdown` | `InlineSerialiser` | The Pandoc inline footnote form, `^[…]`. A nested sidenote is flattened to its body first. |
| `escapeMarkdown` | `(text: string) => string` | Backslash-escapes the CommonMark inline metacharacters. Exported for an app's own serialisers. |

**Declaring and narrowing a shape.** A shape costs nothing to import — no ProseKit, no compiled ProseMirror schema — and is shared by the model layer, the persistence layer and the editor.

```ts
import { defineAllowList, defineDocumentShape } from '@thomasfosterau/prosekit-utilities';

export const blockDocument = defineDocumentShape({ name: 'blockDocument' });
blockDocument.empty(); // { type: 'blockDocument', content: [] }

export const COMMENT = defineAllowList({
  label: 'a comment',
  nodes: ['paragraph', 'text', 'hardBreak'],
  marks: ['bold', 'italic', 'strike', 'code', 'link'],
});

// Decode-time rejection: the allow-list composed onto the shape's codec.
const CommentBody = blockDocument.narrow(COMMENT);
Schema.decodeUnknownSync(CommentBody)(untrusted);
// → 'node type "heading" is not permitted in a comment'
```

**Checking a write.**

```ts
import { checkAllowList } from '@thomasfosterau/prosekit-utilities';

const checkComment = checkAllowList(COMMENT);

checkComment(body).pipe(
  Effect.catchTag('DocumentViolation', (violation) =>
    Effect.succeed({ field: 'body', kind: violation.kind, detail: violation.message }),
  ),
);
```

**Serialising Markdown with an application node.**

```ts
import {
  createMarkdownSerialiser,
  figureMarkdown,
  mentionMarkdown,
} from '@thomasfosterau/prosekit-utilities';

const toMarkdown = createMarkdownSerialiser({
  blocks: { figure: figureMarkdown },
  inlines: { mention: mentionMarkdown },
  marks: { highlight: (text) => `==${text}==` },
});

toMarkdown.document(post.body); // multi-line Markdown
toMarkdown.inline(post.title); // one line
```

**The envelope remap.** A persisted document's root `type` is the surface's own name; a compiled ProseMirror schema's top node is always `doc`. Feeding the stored shape straight into an editor throws `RangeError: Unknown node type: blockDocument`.

```ts
import { fromEditorDocument, toEditorDocument } from '@thomasfosterau/prosekit-utilities';

const forEditor = toEditorDocument(stored); // { type: 'doc', … }
const forStore = fromEditorDocument('blockDocument')(forEditor);
```

---

# `./derive` — the derivation engine

```ts
import { createEditor } from 'prosekit/core';
import { deriveDocumentSchema } from '@thomasfosterau/prosekit-utilities/derive';
import * as Schema from 'effect/Schema';

const { schema } = createEditor({ extension });
const Document = deriveDocumentSchema(schema, { topTypeName: 'blockDocument' });
const doc = Schema.decodeUnknownSync(Document)(json);
```

Reads an Effect Schema back out of a compiled ProseMirror schema at runtime, so the grammar an editor already knows is never hand-transcribed a second time: node and mark **names**, **groups**, the **content model** (which children, whether it may be empty), and admissible **marks** are recovered exactly by walking the compiled `ContentMatch` automaton. ProseMirror does not expose attribute _value_ types — an `AttributeSpec` carries only a `default` and an optional `validate` hint — so attributes are recovered best-effort (`validate` grammar → `typeof` of a non-null `default` → `Schema.Unknown`), and the {@link AttributeOverlay} seam is where a caller supplies the rest. The derived schema complements, rather than replaces, a hand-written generative document contract, which still owns the attribute value types.

| Export | Signature | Notes |
| --- | --- | --- |
| `deriveDocumentSchema` | `(schema: PmSchema, options?: DeriveDocumentOptions) => Schema.Codec<DerivedNodeJSON>` | Rooted at `schema.topNodeType`; `topTypeName` renames it. |
| `deriveDocumentSchemas` | `<Specs extends Record<string, DocumentSchemaSpec>>(schemas: Specs, options?: DeriveOptions) => { readonly [K in keyof Specs]: Schema.Codec<DerivedNodeJSON> }` | Several related document schemas, sharing one `Registry` so common structure (a shared `text` node, shared marks) derives once. Results stay fully independent codecs — only the derivation is shared. Eager: every entry compiles up front. |
| `deriveNodeSchema` | `(nodeType: NodeType, options?: DeriveOptions) => Schema.Codec<DerivedNodeJSON>` | One node's recursive subtree. |
| `deriveMarkSchema` | `(markType: MarkType, options?: DeriveOptions) => Schema.Codec<DerivedMarkJSON>` | One mark's `{ type, attrs? }` shape. |
| `DocumentSchemaSpec` | `{ readonly schema: PmSchema; readonly topTypeName?: string }` | One entry in a `deriveDocumentSchemas` call. |
| `attributeOverlay` | `(overrides: Readonly<Record<string, Readonly<Record<string, Schema.Top \| RequiredAttribute>>>>) => AttributeOverlay` | Builds an overlay from a nested record keyed by owner name then attribute name — a convenience over writing the function by hand for static overrides. |
| `required` | `(schema: Schema.Top) => RequiredAttribute` | Wraps an overlay schema so the derived key is required, overriding ProseMirror's default-implies-optional rule. |
| `isRequiredAttribute` | `(value: unknown) => value is RequiredAttribute` | True for a value `required` produced. |
| `AttributeOverlay` | `(owner: AttributeOwner, attribute: string, spec: AttributeSpec) => Option.Option<Schema.Top \| RequiredAttribute>` | Consulted before deriving each attribute; `Option.some` overrides, `Option.none()` falls back to the automatic derivation. |
| `AttributeOwner` | `{ readonly kind: 'node' \| 'mark'; readonly name: string }` | Identifies the node or mark type an attribute being derived belongs to. |
| `DeriveOptions` | `{ readonly attributes?: AttributeOverlay; readonly includeMarks?: boolean; readonly nonEmptyRequiredContent?: boolean }` | Options common to every entry point — see the table below. |
| `DeriveDocumentOptions` | `DeriveOptions & { readonly topTypeName?: string }` | Options for `deriveDocumentSchema` / one entry of `deriveDocumentSchemas`. |
| `DerivedMarkJSON` | `{ readonly type: string; readonly attrs?: Record<string, unknown> }` | A derived mark's JSON shape. |
| `DerivedNodeJSON` | `{ readonly type: string; readonly attrs?: Record<string, unknown>; readonly content?: ReadonlyArray<DerivedNodeJSON>; readonly marks?: ReadonlyArray<DerivedMarkJSON>; readonly text?: string }` | A derived node's recursive JSON shape. |
| `RequiredAttribute` | `{ readonly schema: Schema.Top }` (branded with a private `unique symbol`) | Constructed only by `required`; detected only by `isRequiredAttribute`. |
| `Registry` | `class Registry { constructor(schema: PmSchema, options?: DeriveOptions, cache?: RegistryCache); mark(markType: MarkType): Schema.Codec<DerivedMarkJSON>; node(nodeType: NodeType): Schema.Codec<DerivedNodeJSON>; nodeAs(nodeType: NodeType, typeName: string): Schema.Codec<DerivedNodeJSON> }` | The memoised, mutually-recursive builder (`Schema.suspend`) every entry point reads from. `nodeAs` is not memoised — used for a renamed top node. |
| `createRegistryCache` | `() => RegistryCache` | A fresh, empty cache, private to one `Registry` unless explicitly shared. |
| `RegistryCache` | `{ readonly nodeCache: Map<string, Schema.Codec<DerivedNodeJSON>>; readonly markCache: Map<string, Schema.Codec<DerivedMarkJSON>> }` | Shared across `Registry` instances so structure two schemas have in common is built once — memoised by mark/node **name**, so only correct when same-named types across the schemas are structurally identical. |
| `Attribute`, `Content`, `Derive`, `Options` | Namespace re-exports (`export * as X`) | The lower-level modules the entry points above are built from — see [Layout](#derive-layout). |

### Options

| Option | Applies to | Default | Effect |
| --- | --- | --- | --- |
| `attributes` | all | — | Consulted before deriving each attribute. |
| `includeMarks` | all | `true` | `false` omits the `marks` field from inline nodes entirely. |
| `nonEmptyRequiredContent` | all | `true` | Required content (`block+`) is a `NonEmptyArray`; `false` for a lenient possibly-empty array. |
| `topTypeName` | `deriveDocumentSchema` | — | Overrides the top node's `type` literal. |

### Notes on fidelity

- **Marks live on inline nodes.** In ProseMirror JSON, marks serialise on the inline (text and inline-leaf) nodes; the permission to carry a mark comes from the containing textblock's `markSet`. The derivation attaches an optional `marks` field to inline nodes, admitting the union of marks any textblock in the schema allows.
- **Attribute key optionality follows ProseMirror.** An attribute with a `default` (any value, `null` included) is an optional key; one with no default is required — the same split `NodeType.hasRequiredAttrs()` reports.
- **Unknown keys are ignored, not rejected**, matching `Schema.Struct`'s default and ProseMirror's own `nodeFromJSON`. The derived schema is accept-superset on stray keys and strips them on decode.
- **Content is a set, not a sequence.** The derivation models content as an array of a child union (all admissible child types), not the exact ordered content expression — the granularity ProseKit's uniform group-based grammars need.

### <a name="derive-layout"></a>Layout

| Module | Responsibility |
| --- | --- |
| `Derive` | Public `deriveNodeSchema` / `deriveMarkSchema` / `deriveDocumentSchema` / `deriveDocumentSchemas`. |
| `Registry` | The memoised, mutually-recursive builder; its cache can be shared across `Registry` instances (`RegistryCache`, `createRegistryCache`). |
| `Attribute` | Attribute schema and key-optionality derivation, the `validate`-grammar parser. |
| `Content` | Allowed child types and cardinality, by walking the `ContentMatch` automaton. |
| `Options` | Option and result types, the `attributeOverlay` helper. |

**Deriving several related documents at once.** When two document schemas are assembled from overlapping ProseKit extensions — a block and an inline editor that both compose the same marks and `text` node — `deriveDocumentSchemas` derives them together, sharing one registry:

```ts
import { deriveDocumentSchemas } from '@thomasfosterau/prosekit-utilities/derive';

const { block, inline } = deriveDocumentSchemas(
  {
    block: { schema: blockSchema, topTypeName: 'blockDocument' },
    inline: { schema: inlineSchema, topTypeName: 'inlineDocument' },
  },
  { attributes: ATTRIBUTE_OVERLAY },
);
```

A caller that instead needs each document to stay independently lazy — never compiling schema B just because schema A was validated — shares a `RegistryCache` across separate `Registry` instances directly, one per schema, each built inside its own deferred call site. `./prosekit`'s `defineDocumentSchema` (below) is that pattern.

**Supplying attribute value types.**

```ts
const Document = deriveDocumentSchema(schema, {
  topTypeName: 'blockDocument',
  attributes: attributeOverlay({
    heading: { level: Schema.Literals([1, 2, 3, 4, 5, 6]) },
    image: { src: Schema.NullOr(Schema.String) },
  }),
});
```

---

# `./prosekit` — the ProseKit runtime half

The only entry that imports `prosekit` at the value level, so a browser-reachable model layer imports `.` and leaves this one to server code and editor routes.

## Nodes

| Export | Signature | Notes |
| --- | --- | --- |
| `defineDoc`, `defineText`, `defineParagraph`, `defineHeading`, `defineList`, `defineBlockquote`, `defineImage`, `defineHorizontalRule`, `defineHardBreak`, `defineTable`, `defineCodeBlock` | `() => Extension` (+ `DocExtension`, `TextExtension`, `ParagraphExtension`, `HeadingExtension`, `ListExtension`, `BlockquoteExtension`, `ImageExtension`, `HorizontalRuleExtension`, `HardBreakExtension`, `TableExtension`, `CodeBlockExtension` types) | ProseKit's stock node extensions, re-exported so one grammar comes from one import. |
| `defineInlineDoc` | `() => Extension` | A `doc` top node with `content: "inline*"` — the shape a single-line rich-text field wants. |
| `defineMention` | `() => Extension` | **Opt-in.** Inline atom, attrs `id`/`label`, `parseDOM` on `span[data-mention-id]`, `toDOM` to `<span data-mention-id data-mention-label class="mention">@label</span>`. Not ProseKit's stock `mention` — its attribute shape differs from what already-persisted documents carry. |
| `defineFigcaption` | `() => Extension` | **Opt-in.** `content: "inline*"`, so a caption can never nest a block. |
| `defineFigureNode` | `() => Extension` | **Opt-in.** `group: "block"`, `content: "image figcaption"`, `defining`. Unusable without `defineFigcaption` and the stock `image` in the same extension. |
| `defineFigure` | `() => Extension` | **Opt-in.** `defineFigureNode()` + `defineFigcaption()`. |
| `defineSidenote` | `() => Extension` | **Opt-in.** Inline, non-atom, `selectable`, `defining`, `content: "(text \| hardBreak)*"` — rich editable inline content that **cannot nest another sidenote**. `toDOM` to `<span data-sidenote>`; placement is CSS-only and ships no styles. |

## Marks

| Export | Signature | Notes |
| --- | --- | --- |
| `defineBold`, `defineItalic`, `defineUnderline`, `defineStrike`, `defineCode`, `defineLink` | `() => Extension` (+ `BoldExtension`, `ItalicExtension`, `UnderlineExtension`, `StrikeExtension`, `CodeExtension`, `LinkExtension` types) | ProseKit's stock mark extensions, re-exported. |
| `defineHighlight`, `defineSubscript`, `defineSuperscript` | `() => Extension` | This library's own `<mark>`/`<sub>`/`<sup>` specs, wire-identical to already-persisted documents; `subscript` and `superscript` mutually exclude. ProseKit's same-named stock extensions carry different attribute shapes and are deliberately not used. |
| `defineCitation` | `() => Extension` | **Opt-in.** Mark with attr `workId`, `parseDOM` on `cite[data-work-id]`, `toDOM` to `<cite data-work-id>`. A mark, not a node, so a citation can never swallow structure. |
| `defineStandardMarks` | `() => Extension` | The nine: the six stock marks plus highlight, subscript, superscript. `citation` is not in the set. |

## Presets

| Export | Signature | Notes |
| --- | --- | --- |
| `defineEditorBehaviour` | `() => Extension` | Base keymap, base commands, history, gap cursor, virtual selection, mod-click prevention. Registers no node and no mark, so it never affects a derived wire schema. Compose it at most once per extension — ProseMirror rejects two instances of the same keyed plugin. |
| `defineBlockDocumentExtension` | `(...extra: ReadonlyArray<Extension>) => Extension` | `doc` + `text` + the stock block set + `defineStandardMarks()` + `defineEditorBehaviour()` + `extra`. |
| `defineInlineDocumentExtension` | `(...extra: ReadonlyArray<Extension>) => Extension` | `defineInlineDoc()` + `text` + `defineStandardMarks()` + `defineEditorBehaviour()` + `extra`. No block node is registered at all — a paragraph fails to decode, not merely unreachable from a toolbar. |
| `BlockDocumentExtension`, `InlineDocumentExtension` | `ReturnType<typeof defineBlockDocumentExtension>` / `ReturnType<typeof defineInlineDocumentExtension>` | The extension each preset returns with no extras. |

## Schemas and attributes

| Export | Signature | Notes |
| --- | --- | --- |
| `lazySchema` | `(define: () => Extension) => () => PmSchema` | Compile-once, cache-forever (`Option`-backed). Never call `createEditor` on a per-row or per-render path — PERF-CPU-001. |
| `AttributeOverrides` | `Readonly<Record<string, Readonly<Record<string, Schema.Top \| RequiredAttribute>>>>` | The record `attributeOverlay()` (`./derive`) consumes. |
| `STANDARD_ATTRIBUTE_OVERRIDES` | `AttributeOverrides` | `heading.level`, `list.kind`/`order`, `image.src`/`width`/`height`, `codeBlock.language`, `tableCell`/`tableHeaderCell.colwidth`. Attributes a live editor always serialises (`heading.level`, `list.kind`, `image.src`/`width`/`height`, `codeBlock.language`) are wrapped in `required(…)`; `colwidth` is not, because an unresized cell genuinely has none. |
| `MENTION_ATTRIBUTE_OVERRIDES` | `AttributeOverrides` | `mention: { id: required(Schema.String), label: required(Schema.String) }` — merge in when the grammar includes `defineMention()`. |
| `mergeAttributeOverrides` | `(...overrides: ReadonlyArray<AttributeOverrides>) => AttributeOverrides` | Shallow per node, then per attribute; later wins. Non-mutating. |
| `defineDocumentSchema` | `<Name extends string>(shape: DocumentShape<Name>, options: DocumentSchemaOptions) => DocumentSchema<Name>` | The centrepiece: `Schema.suspend` + `Registry.nodeAs(topNodeType, shape.name)`. Nothing compiles or derives at declaration time. |
| `DocumentSchemaOptions` | `{ readonly extension: () => Extension; readonly attributes?: AttributeOverrides \| undefined; readonly registryCache?: RegistryCache \| undefined }` | `attributes` defaults to `STANDARD_ATTRIBUTE_OVERRIDES`; `registryCache` defaults to a cache private to this schema. |
| `DocumentSchema<Name>` | `{ readonly shape: DocumentShape<Name>; readonly extension: () => Extension; readonly schema: () => PmSchema; readonly Document: Schema.Codec<DocumentJSON<Name>>; readonly is: (v: unknown) => v is DocumentJSON<Name>; readonly decode: (v: unknown) => Effect.Effect<DocumentJSON<Name>, DocumentDecodeError>; readonly install: () => void }` | `is` keeps a try/catch defect net; `install()` is `shape.install(is)`. Satisfies `./drizzle`'s `HasDocumentSchema<A>` structurally. |
| `installDocumentGrammars` | `(...schemas: ReadonlyArray<DocumentSchema<string>>) => void` | The persistence module's one call. Forces no derivation — installing just stores a function reference. |
| `DocumentDecodeError` | `class DocumentDecodeError extends Schema.TaggedError<DocumentDecodeError>()('DocumentDecodeError', { document: Schema.String, issue: Schema.Defect() }) {}` | Wraps the underlying `SchemaError` for a caller that wants a tagged channel; `Document` itself stays a plain codec. |

## <a name="prosekit-html"></a>HTML

| Export | Signature | Notes |
| --- | --- | --- |
| `sanitiseDocument` | `(node: NodeJSON) => NodeJSON` | Recursive, non-mutating: drops `link` marks with an unsafe `href` and `image` children with an unsafe `src`. Run automatically by every render; exported for other boundaries. |
| `createHtmlRenderer` | `(options: HtmlRendererOptions) => HtmlRenderer` | Sanitises, rewrites the envelope's `type` back to `doc`, then `htmlFromJSON`. Cheap to create; holds the resolved `Document` — create one per grammar at module scope, never per render. |
| `HtmlRendererOptions` | `{ readonly schema: () => PmSchema; readonly postProcess?: ((html: string, document: Document) => string) \| undefined; readonly document?: (() => Promise<Document>) \| undefined }` | `document` defaults to capability detection — the global `document` if defined, otherwise `linkedom`'s `parseHTML(…).document` — resolved once per renderer. |
| `HtmlRenderer` | `{ readonly render: (doc: NodeJSON \| DocumentJSON) => Effect.Effect<string, HtmlRenderError>; readonly renderPromise: (doc: NodeJSON \| DocumentJSON) => Promise<string> }` | Two shapes over one implementation; `renderPromise` rejects with the tagged error itself. |
| `HtmlRenderError` | `class HtmlRenderError extends Schema.TaggedError<HtmlRenderError>()('HtmlRenderError', { reason: Schema.Literals(['dom-unavailable', 'serialise']), cause: Schema.Defect() }) {}` | `dom-unavailable` when no `Document` could be obtained; `serialise` when the document or the `postProcess` hook could not produce HTML. |

**Composing an extension and linking it to a shape** — see [Declaring a document surface](#declaring-a-document-surface) above for the full worked example. **Rendering HTML**, with a placeholder-filling hook:

```ts
import { createHtmlRenderer } from '@thomasfosterau/prosekit-utilities/prosekit';
import { blockDocumentSchema } from './document-schemas.ts';

export const blockRenderer = createHtmlRenderer({
  schema: blockDocumentSchema.schema,
  postProcess: (html, document) => expandPlaceholders(html, document),
});

// Inside Effect, with the failure in the error channel:
const program = Effect.gen(function* () {
  const html = yield* blockRenderer.render(post.body);
  return html;
}).pipe(
  Effect.catchTag('HtmlRenderError', (error) =>
    Effect.succeed(error.reason === 'dom-unavailable' ? '' : '<p>Could not render.</p>'),
  ),
);
```

On the server this resolves to `linkedom`, never `happy-dom`: happy-dom pulls in `node:child_process` and `node:vm`, which a Worker runtime does not provide, so the import would fail at request time and take down every page that renders prose. The branch is chosen by capability detection (is there a global `document`?) rather than an `import.meta.env.SSR`-style flag, because that flag reads `false` under a node test environment and would pick the browser path exactly where it must not.

---

# `./drizzle`

| Export | Signature | Notes |
| --- | --- | --- |
| `jsonbSchemaColumn` | `<A>(schema: Schema.Codec<A, A>) => (name: string) => PgCustomColumnBuilder<{ data: A; driverData: string }>` | Generalises the apps' `customType` body over any codec: `dataType() = 'jsonb'`, `toDriver` = `Schema.encodeSync` over the wire form, `fromDriver` = a three-branch decode (string driver value / already-parsed / non-string) that validates. `null` passes through untouched. Validates on read only — the write path is trusted upstream. |
| `documentColumn` | `<A>(schema: HasDocumentSchema<A>) => (name: string) => PgCustomColumnBuilder<{ data: A; driverData: string }>` | `jsonbSchemaColumn(schema.Document)` — the strict, ProseKit-derived schema, SEC-XSS-001 on the read direction. Pass a `DocumentSchema` from `./prosekit`. |
| `HasDocumentSchema<A>` | `{ readonly Document: Schema.Codec<A, A> }` | The one piece of `./prosekit`'s `DocumentSchema` this entry needs, written structurally so `./drizzle` never imports `./prosekit` (or ProseKit) at all — a consumer can depend on this entry alone. |
| `documentTextSql` | `(column: AnyPgColumn \| SQL) => SQL<string>` | The `jsonb_path_query_array(... 'strict $.** ? (@.type == "text").text')` fragment, unnested and joined with `' '` — the SQL twin of `extractDocumentText` (the root entry), tested against the same fixtures. |

```ts
import { pgTable, uuid } from 'drizzle-orm/pg-core';
import {
  documentColumn,
  documentTextSql,
  jsonbSchemaColumn,
} from '@thomasfosterau/prosekit-utilities/drizzle';
import { blockDocumentSchema } from './document-schemas.ts';

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  body: documentColumn(blockDocumentSchema)('body_jsonb').notNull(),
});

// A generated/materialised text column for search, from the same jsonpath
// fragment `extractDocumentText` walks in JS.
export const postSearchText = documentTextSql(posts.body);

// A column backed by a plain Effect Schema, no ProseKit document involved:
export const settings = pgTable('settings', {
  preferences: jsonbSchemaColumn(PreferencesSchema)('preferences_jsonb'),
});
```

---

## Wire compatibility

**The derivation is the contract.** `./derive` reads node and mark names, groups, the content model and admissible marks off the compiled ProseMirror schema; `./prosekit`'s node and mark specs and `STANDARD_ATTRIBUTE_OVERRIDES` decide the rest. Stored documents are content-addressed and immutable in the consuming apps, so a change to any of these — a spec's shape, an attribute override, which marks a node admits — changes what already-stored rows decode as. `prosemirror-model`/`prosemirror-view` are pinned exactly in the catalog for the same reason.

**The envelope is not versioned.** There is no `version` field on `DocumentJSON` and no normalisation or migration hook: this library decodes exactly what the current derivation accepts, nothing more permissive. A grammar change that needs already-stored rows to keep decoding is a **major** release, not a runtime compatibility shim.

**The golden-fixture suite is the proof.** `tests/prosekit/document-models.test.ts` pins the wire shape of every node and mark this library defines, so a change that would silently alter what a stored document decodes as fails a test rather than shipping quietly.

## Testing

Suites run under node Vitest (`vite-plus/test`, never `vitest` directly). Most of the package needs no DOM at all — the derivation, the allow-list walk, text extraction, URL safety and the Markdown serialiser are pure tree-walks over JSON. The exceptions carry a happy-dom pragma at the top of the file: anything that mounts a real ProseKit editor view (an extension smoke test) or exercises the browser branch of `createHtmlRenderer`'s capability detection needs a global `document` to select that branch, which happy-dom supplies without pulling in an actual browser.
