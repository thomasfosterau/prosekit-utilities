---
'@thomasfosterau/prosekit-svelte': minor
---

First release of the Svelte 5 editor components on ProseKit (`0.0.0` → `0.1.0`; the package has never been published), rebuilt from the two apps' `editor-ui` packages on bits-ui.

- `Editor` (generic over the ProseKit extension; `content` two-way bound, `defaultContent` seeds once, `label`, `children` for a toolbar), `BlockEditor` and `InlineEditor` (the envelope remap through `documentType`, a hidden form input under `name`, default extensions from the core presets; `InlineEditor` absorbs the old `InlineEditorInput` and keeps Enter from inserting a paragraph).
- `BlockToolbar` — declarative: a `ToolbarItem[]` (with `ToolbarSeparator`s) and a `SlashCommand[]` rendered on a bits-ui `Toolbar` with roving focus and `aria-pressed`, and an insert menu (`SlashMenu`) on a bits-ui `DropdownMenu`; items receive a `ToolbarRunContext` (`editor: ToolbarEditor`, `dialogs.link()`, `dialogs.image()`). `createDefaultToolbarItems()` / `createDefaultSlashCommands()` give the shared base grammar's set; an app appends items for its own nodes. The toolbar renders above the document.
- `LinkDialog` and `ImageDialog` on a bits-ui `Dialog`, replacing `window.prompt`; the link dialog validates with the core's `isSafeHref`.
- Every string is a prop with an English default; `setEditorMessages` / `getEditorMessages` is an optional per-render-site override of those defaults. No Effect anywhere in the package.
- Storied in Storybook 10 with the a11y addon and tested in headless Chromium under Vitest browser mode with real pointer and keyboard events.
