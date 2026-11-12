# Derivation

How `@thomasfosterau/prosekit-utilities/derive` reads an Effect Schema back out of a compiled ProseMirror schema, what it recovers exactly and what it has to guess, and how `./prosekit`'s attribute overrides supply the rest. The derivation is the library's wire contract: [Document surfaces](document-surfaces.md#wire-compatibility) says why a change to it is a major release. The API reference is the TSDoc on each export.

```ts
import { createEditor } from 'prosekit/core';
import { deriveDocumentSchema } from '@thomasfosterau/prosekit-utilities/derive';
import * as Schema from 'effect/Schema';

const { schema } = createEditor({ extension });
const Document = deriveDocumentSchema(schema, { topTypeName: 'blockDocument' });
const doc = Schema.decodeUnknownSync(Document)(json);
```

Reads an Effect Schema back out of a compiled ProseMirror schema at runtime, so the grammar an editor already knows is never hand-transcribed a second time: node and mark **names**, **groups**, the **content model** (which children, whether it may be empty), and admissible **marks** are recovered exactly by walking the compiled `ContentMatch` automaton. ProseMirror does not expose attribute _value_ types — an `AttributeSpec` carries only a `default` and an optional `validate` hint — so attributes are recovered best-effort (`validate` grammar → `typeof` of a non-null `default` → `Schema.Unknown`), and the `AttributeOverlay` seam is where a caller supplies the rest. The derived schema complements, rather than replaces, a hand-written generative document contract, which still owns the attribute value types.

## Exports

| Export | Notes |
| --- | --- |
| `deriveDocumentSchema` | Rooted at `schema.topNodeType`; `topTypeName` renames it. |
| `deriveDocumentSchemas` | Several related document schemas, sharing one `Registry` so common structure (a shared `text` node, shared marks) derives once. Results stay fully independent codecs — only the derivation is shared. Eager: every entry compiles up front. |
| `deriveNodeSchema` | One node's recursive subtree. |
| `deriveMarkSchema` | One mark's `{ type, attrs? }` shape. |
| `DocumentSchemaSpec` | One entry in a `deriveDocumentSchemas` call. |
| `attributeOverlay` | Builds an overlay from a nested record keyed by owner name then attribute name — a convenience over writing the function by hand for static overrides. |
| `required` | Wraps an overlay schema so the derived key is required, overriding ProseMirror's default-implies-optional rule. |
| `isRequiredAttribute` | True for a value `required` produced. |
| `AttributeOverlay` | Consulted before deriving each attribute; `Option.some` overrides, `Option.none()` falls back to the automatic derivation. |
| `AttributeOwner` | Identifies the node or mark type an attribute being derived belongs to. |
| `DeriveOptions` | Options common to every entry point — see the table below. |
| `DeriveDocumentOptions` | Options for `deriveDocumentSchema` / one entry of `deriveDocumentSchemas`. |
| `DerivedMarkJSON` | A derived mark's JSON shape. |
| `DerivedNodeJSON` | A derived node's recursive JSON shape. |
| `RequiredAttribute` | Constructed only by `required`; detected only by `isRequiredAttribute`. |
| `Registry` | The memoised, mutually-recursive builder (`Schema.suspend`) every entry point reads from. `nodeAs` is not memoised — used for a renamed top node. |
| `createRegistryCache` | A fresh, empty cache, private to one `Registry` unless explicitly shared. |
| `RegistryCache` | Shared across `Registry` instances so structure two schemas have in common is built once — memoised by mark/node **name**, so only correct when same-named types across the schemas are structurally identical and the schemas admit the same marks (an inline node's `marks` field is the schema-wide mark union). |
| `Attribute`, `Content`, `Derive`, `Options` | The lower-level modules the entry points above are built from — see [Layout](#derive-layout). |

## Options

| Option | Applies to | Default | Effect |
| --- | --- | --- | --- |
| `attributes` | all | — | Consulted before deriving each attribute. |
| `includeMarks` | all | `true` | `false` omits the `marks` field from inline nodes entirely. |
| `nonEmptyRequiredContent` | all | `true` | Required content (`block+`) is a `NonEmptyArray`; `false` for a lenient possibly-empty array. |
| `topTypeName` | `deriveDocumentSchema` | — | Overrides the top node's `type` literal. |

## Notes on fidelity

- **Marks live on inline nodes.** In ProseMirror JSON, marks serialise on the inline (text and inline-leaf) nodes; the permission to carry a mark comes from the containing textblock's `markSet`. The derivation attaches an optional `marks` field to inline nodes, admitting the union of marks any textblock in the schema allows.
- **Attribute key optionality follows ProseMirror.** An attribute with a `default` (any value, `null` included) is an optional key; one with no default is required — the same split `NodeType.hasRequiredAttrs()` reports.
- **Unknown keys are ignored, not rejected**, matching `Schema.Struct`'s default and ProseMirror's own `nodeFromJSON`. The derived schema is accept-superset on stray keys and strips them on decode.
- **Content is a set, not a sequence.** The derivation models content as an array of a child union (all admissible child types), not the exact ordered content expression — the granularity ProseKit's uniform group-based grammars need.

## <a name="derive-layout"></a>Layout

| Module | Responsibility |
| --- | --- |
| `Derive` | Public `deriveNodeSchema` / `deriveMarkSchema` / `deriveDocumentSchema` / `deriveDocumentSchemas`. |
| `Registry` | The memoised, mutually-recursive builder; its cache can be shared across `Registry` instances (`RegistryCache`, `createRegistryCache`). |
| `Attribute` | Attribute schema and key-optionality derivation, the `validate`-grammar parser. |
| `Content` | Allowed child types and cardinality, by walking the `ContentMatch` automaton. |
| `Options` | Option and result types, the `attributeOverlay` helper. |

## Deriving several related documents at once

When two document schemas are assembled from overlapping ProseKit extensions — a block and an inline editor that both compose the same marks and `text` node — `deriveDocumentSchemas` derives them together, sharing one registry:

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

## Supplying attribute value types

```ts
const Document = deriveDocumentSchema(schema, {
  topTypeName: 'blockDocument',
  attributes: attributeOverlay({
    heading: { level: Schema.Literals([1, 2, 3, 4, 5, 6]) },
    image: { src: Schema.NullOr(Schema.String) },
  }),
});
```

## Schemas and attribute overrides in `./prosekit`

`./prosekit` ships the overlay entries for the nodes it defines, so `defineDocumentSchema` needs no hand-written overlay for the standard grammar. [Document surfaces](document-surfaces.md) shows `defineDocumentSchema` in context.

| Export | Notes |
| --- | --- |
| `lazySchema` | Compile-once, cache-forever (`Option`-backed). Never call `createEditor` on a per-row or per-render path — PERF-CPU-001. |
| `AttributeOverrides` | The record `attributeOverlay()` (`./derive`) consumes. |
| `STANDARD_ATTRIBUTE_OVERRIDES` | `heading.level`, `list.kind`/`order`, `image.src`/`width`/`height`, `codeBlock.language`, `tableCell`/`tableHeaderCell.colwidth`. Attributes a live editor always serialises (`heading.level`, `list.kind`, `image.src`/`width`/`height`, `codeBlock.language`) are wrapped in `required(…)`; `colwidth` is not, because an unresized cell genuinely has none. |
| `MENTION_ATTRIBUTE_OVERRIDES` | `mention: { id: required(Schema.String), label: required(Schema.String) }` — merge in when the grammar includes `defineMention()`. |
| `mergeAttributeOverrides` | Shallow per node, then per attribute; later wins. Non-mutating. |
| `defineDocumentSchema` | The centrepiece: `Schema.suspend` + `Registry.nodeAs(topNodeType, envelope.name)`. Nothing compiles or derives at declaration time. |
| `DocumentSchemaOptions` | `attributes` defaults to `STANDARD_ATTRIBUTE_OVERRIDES`; `registryCache` defaults to a cache private to this schema; share one only between grammars with matching mark sets. |
| `DocumentSchema<Name>` | `is` keeps a try/catch defect net; `install()` is `shape.install(is)`. Satisfies `./drizzle`'s `HasDocumentSchema<A>` structurally. |
| `installDocumentGrammars` | The persistence module's one call. Forces no derivation — installing just stores a function reference. |
| `DocumentDecodeError` | Wraps the underlying `SchemaError` for a caller that wants a tagged channel; `Document` itself stays a plain codec. |
