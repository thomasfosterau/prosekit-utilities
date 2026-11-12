# Nodes, marks and presets

The ProseKit extensions `@thomasfosterau/prosekit-utilities/prosekit` defines, which of them are opt-in, and the presets that compose them. Their specs are wire-compatible with documents the owner's apps already persisted, so the notes below record why a spec differs from ProseKit's stock one. `./prosekit` is the only entry that imports `prosekit` at the value level, so a browser-reachable model layer imports `.` and leaves this one to server code and editor routes. The API reference is the TSDoc on each export; [Document surfaces](document-surfaces.md) shows them composed into a surface.

## Nodes

| Export | Notes |
| --- | --- |
| `defineDoc`, `defineText`, `defineParagraph`, `defineHeading`, `defineList`, `defineBlockquote`, `defineImage`, `defineHorizontalRule`, `defineHardBreak`, `defineTable`, `defineCodeBlock` | ProseKit's stock node extensions, re-exported so one grammar comes from one import. |
| `defineInlineDoc` | A `doc` top node with `content: "inline*"` — the shape a single-line rich-text field wants. |
| `defineMention` | **Opt-in.** Inline atom, attrs `id`/`label`, `parseDOM` on `span[data-mention-id]`, `toDOM` to `<span data-mention-id data-mention-label class="mention">@label</span>`. Not ProseKit's stock `mention` — its attribute shape differs from what already-persisted documents carry. |
| `defineFigcaption` | **Opt-in.** `content: "inline*"`, so a caption can never nest a block. |
| `defineFigureNode` | **Opt-in.** `group: "block"`, `content: "image figcaption"`, `defining`. Unusable without `defineFigcaption` and the stock `image` in the same extension. |
| `defineFigure` | **Opt-in.** `defineFigureNode()` + `defineFigcaption()`. |
| `defineSidenote` | **Opt-in.** Inline, non-atom, `selectable`, `defining`, `content: "(text \| hardBreak)*"` — rich editable inline content that **cannot nest another sidenote**. `toDOM` to `<span data-sidenote>`; placement is CSS-only and ships no styles. |

## Marks

| Export | Notes |
| --- | --- |
| `defineBold`, `defineItalic`, `defineUnderline`, `defineStrike`, `defineCode`, `defineLink` | ProseKit's stock mark extensions, re-exported. |
| `defineHighlight`, `defineSubscript`, `defineSuperscript` | This library's own `<mark>`/`<sub>`/`<sup>` specs, wire-identical to already-persisted documents; `subscript` and `superscript` mutually exclude. ProseKit's same-named stock extensions carry different attribute shapes and are deliberately not used. |
| `defineCitation` | **Opt-in.** Mark with attr `workId`, `parseDOM` on `cite[data-work-id]`, `toDOM` to `<cite data-work-id>`. A mark, not a node, so a citation can never swallow structure. |
| `defineStandardMarks` | The nine: the six stock marks plus highlight, subscript, superscript. `citation` is not in the set. |

## Presets

| Export | Notes |
| --- | --- |
| `defineEditorBehaviour` | Base keymap, base commands, history, gap cursor, virtual selection, mod-click prevention. Registers no node and no mark, so it never affects a derived wire schema. Compose it at most once per extension — ProseMirror rejects two instances of the same keyed plugin. |
| `defineBlockDocumentExtension` | `doc` + `text` + the stock block set + `defineStandardMarks()` + `defineEditorBehaviour()` + `extra`. |
| `defineInlineDocumentExtension` | `defineInlineDoc()` + `text` + `defineStandardMarks()` + `defineEditorBehaviour()` + `extra`. No block node is registered at all — a paragraph fails to decode, not merely unreachable from a toolbar. |
| `BlockDocumentExtension`, `InlineDocumentExtension` | The extension each preset returns with no extras. |
