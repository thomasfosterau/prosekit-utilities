# @thomasfosterau/prosekit-svelte

## 0.1.0

### Minor Changes

- 9f91e10: **Breaking (types):** `Editor`, `BlockEditor`, `InlineEditor`, `BlockToolbar` and `SlashMenu` no longer accept `aria-label` or `aria-labelledby` among their native attributes: each owns its accessible name through `label` (`menuLabel` for `SlashMenu`), and passing either is now a type error. Before, a caller's `aria-label` was silently overridden by `label`, and a caller's `aria-labelledby` passed through and outranked it. At runtime an untyped caller's `aria-label` is still overridden, and its `aria-labelledby` is now dropped. Name the editor or menu with `label` / `menuLabel`, or `labelledBy` for a visible heading. The dialogs are unchanged.
- cc59604: `BlockEditor`, `InlineEditor`, `BlockToolbar` and `SlashMenu` now accept the native attributes of the element they render (`id`, `data-*`, `aria-*`, …, except `aria-label` and `aria-labelledby`: the component owns its accessible name) and spread them before their own, so the caller's `class` still merges last. `BlockEditor` and `InlineEditor` forward them to `Editor`'s wrapper; `BlockToolbar` puts them on its `role="toolbar"` element; `SlashMenu` puts them on its `role="menu"` content (an `id` there becomes the trigger's `aria-controls`), while `class` stays on the styling list inside it.
- c80bb9c: `LinkDialog` and `ImageDialog` now accept the native attributes of their dialog element (`id`, `data-*`, `aria-*`, …) and spread them on bits-ui's `Dialog.Content` (`role="dialog"`), where `class` already merges. bits-ui's `role`, `aria-modal` and `aria-labelledby` (the title) still win; with no description of its own, a caller's `aria-describedby` is kept. `LinkDialog` leaves out the native `title`, which is the link's title there.
- 5aa1d54: First release of the Svelte 5 editor components on ProseKit (`0.0.0` → `0.1.0`; the package has never been published), rebuilt from the two apps' `editor-ui` packages on bits-ui.

  - `Editor` (generic over the ProseKit extension; `content` two-way bound, `defaultContent` seeds once, `label`, `children` for a toolbar), `BlockEditor` and `InlineEditor` (the envelope remap through `documentType`, a hidden form input under `name`, default extensions from the core presets; `InlineEditor` absorbs the old `InlineEditorInput` and keeps Enter from inserting a paragraph).
  - `BlockToolbar` — declarative: a `ToolbarItem[]` (with `ToolbarSeparator`s) and a `SlashCommand[]` rendered on a bits-ui `Toolbar` with roving focus and `aria-pressed`, and an insert menu (`SlashMenu`) on a bits-ui `DropdownMenu`; items receive a `ToolbarRunContext` (`editor: ToolbarEditor`, `dialogs.link()`, `dialogs.image()`). `createDefaultToolbarItems()` / `createDefaultSlashCommands()` give the shared base grammar's set; an app appends items for its own nodes. The toolbar renders above the document.
  - `LinkDialog` and `ImageDialog` on a bits-ui `Dialog`, replacing `window.prompt`; the link dialog validates with the core's `isSafeHref`.
  - Every string is a prop with an English default; `setEditorMessages` / `getEditorMessages` is an optional per-render-site override of those defaults. No Effect anywhere in the package.
  - Storied in Storybook 10 with the a11y addon and tested in headless Chromium under Vitest browser mode with real pointer and keyboard events.

- 9a1f39f: `Editor`, `BlockEditor`, `InlineEditor`, `BlockToolbar` and `SlashMenu` take a new `labelledBy` prop: the `id` (or space-separated `id`s) of a visible element, such as a heading, that names the component. Given it, the component renders `aria-labelledby`, so the name tracks the visible text and its translations. It wins over `label` / `menuLabel` and their defaults, which stay on as `aria-label`: the fallback name if no element has that `id`, so a mistyped or not-yet-rendered heading leaves the component named rather than nameless. An empty `labelledBy` counts as unset. `Editor`'s wrapper becomes a `role="group"` when named either way. `BlockEditor` and `InlineEditor` forward it to `Editor`; `BlockToolbar` puts it on its `role="toolbar"` element and `SlashMenu` on its `role="menu"` content. Without it, nothing changes.

### Patch Changes

- 80f4cdd: Documentation only: every Svelte component now carries a one-line `@component` doc that editors show on hover; `documentTextSql`, `documentColumn`, `FlowchartSvgLabels` and `parseFlowchartData` have hover summaries free of app-specific names; the package READMEs drop contributor-only sections and no longer overstate which components spread native attributes.
- fe2af1f: Fixes from type-aware linting, with no change in behaviour: optional parameters drop a redundant `| undefined` (`extractDocumentText`, `isSafeHref`, `createDefaultToolbarItems`, `createDefaultSlashCommands`), `ToolbarEditor` is written over `Editor` rather than `Editor<any>` (the same type), and the flowchart edit dialog loads its canvas through an async function.
- Updated dependencies [80f4cdd]
- Updated dependencies [207f1ac]
- Updated dependencies [0493282]
- Updated dependencies [5aa1d54]
- Updated dependencies [7a7ce2f]
- Updated dependencies [2da48c9]
- Updated dependencies [e13afc2]
- Updated dependencies [fe2af1f]
  - @thomasfosterau/prosekit-utilities@1.0.0
