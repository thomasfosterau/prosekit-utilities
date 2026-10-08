# packages/prosekit-svelte — the editor components

`@thomasfosterau/prosekit-svelte`: the Svelte 5 rich-text editor on ProseKit — `Editor`, `BlockEditor`, `InlineEditor`, the declarative `BlockToolbar` with its insert menu, and the link / image dialogs — built on bits-ui. Everything in `src/lib/` ends up in `dist/` and on npm through `svelte-package`: `svelte-kit sync` generates the ambient types, `svelte-package` copies `src/lib/` compiling nothing, and the consumer's build compiles the `.svelte` files. The Svelte authoring rules (runes and snippets only, `class` merging, literal daisyUI lookup tables, bits-ui for interaction, every string a prop, no Effect) live in [`.claude/rules/svelte.md`](../../.claude/rules/svelte.md); this file carries what is specific to the package.

## Boundary

- **Import siblings only through their published entry points** (the repo-wide rule in the root AGENTS.md): this package reaches `@thomasfosterau/prosekit-utilities` through its built `dist/`. It never imports `effect`, `$app/*` or `$env/*`; the authoring rules are in [`.claude/rules/svelte.md`](../../.claude/rules/svelte.md).

## Invariants

- **`Editor.svelte` carries the package's only side-effecting imports**, `prosekit/basic/style.css` and `prosekit/basic/typography.css` (see the root AGENTS.md on `"sideEffects": false`); `vp run check:dist` fails on a bare import anywhere else.
- **`.storybook/` is the workspace's one Storybook**, `packages/prosekit-flowchart`'s stories included; `preview.css` is the only place the Tailwind + daisyUI stack is built here. `tsconfig.json`'s `include` is `["src", "tests", ".storybook/**/*.ts"]`, so a broken story, test or Storybook config fails `vp run check` exactly like a broken component does. Keep the glob: TypeScript reads a bare `".storybook"` as a file name (a last segment containing `.` is not expanded as a directory), which silently checked nothing there. The flowchart's stories are type-checked by that package's own `check`.
- **Stay out of every always-loaded barrel.** `Editor.svelte`'s bare CSS imports mean that whatever imports this package's barrel pulls ProseKit's stylesheets — and, through `createEditor`, the ProseKit runtime, the largest client chunk in the consuming apps — into its chunk. A consumer imports a component from here by path from a route that genuinely edits a document, or through a dynamic `import()` from one that only sometimes does, and never re-exports it from a shared component barrel. The README says so; the app repos enforce it with bundle-boundary tests.
- **The messages context is set per render site, never from a root layout.** Wiring it from the root layout would mean importing this barrel there, which is the leak above. When no provider is mounted (Storybook, tests, an app that never wires it) every string is its English default — silently un-translated, never broken.
- **The toolbar offers only what the editor's extension can hold.** A `ToolbarItem` that runs a command for a node type the schema lacks throws at runtime, so the default item set covers exactly the `defineBlockDocumentExtension()` preset; an app that composes extra nodes adds their items itself.
- **Editors are created once.** `extension` and the initial content are captured by value when the component mounts; reacting to later prop changes would recreate the editor as the user types. `content` is the two-way channel; `defaultContent` seeds without retriggering.
- **The envelope remap is the editor boundary.** Stored documents carry the app's envelope type (`blockDocument`, `inlineDocument`, …); ProseMirror's top node is always `doc`. `BlockEditor` / `InlineEditor` remap in both directions through the core's `toEditorDocument` / `fromEditorDocument`, and the hidden form input always carries the app shape. Feeding the app shape straight into ProseKit throws `RangeError: Unknown node type`.

## Terms

- **Toolbar item** — `{ id, label, kind?, isActive?, isEnabled?, run }`: one button of `BlockToolbar`. `kind: 'toggle'` renders `aria-pressed` from `isActive`; `run` receives a `ToolbarRunContext` (`editor`, `dialogs.link()`, `dialogs.image()`). A `ToolbarSeparator` (`{ id, separator: true }`) may sit between items.
- **Slash command** — `{ id, label, run }`: one entry of the insert menu (`SlashMenu`, a bits-ui `DropdownMenu` on the toolbar's Insert button). "Slash" is the name the apps used; there is no `/` trigger inside the document.
- **Messages** — `EditorMessages`, one flat record of plain strings: every component label and every default item's label. `createDefaultToolbarItems(messages)` and `createDefaultSlashCommands(messages)` build the default sets from it; component props default to `getEditorMessages()`'s values.
- **Document type** — the `documentType` prop of `BlockEditor` / `InlineEditor`: the envelope name written into the hidden input and stripped on the way in.

## Testing

Vitest **browser mode**, headless Chromium through Playwright — not a DOM shim. ProseMirror needs real layout and selection, and this package's contract is focus order, keyboard handling and the accessibility tree.

- `render` comes from `vitest-browser-svelte` and is **async**; assertions go through `expect.element(locator)`, which retries; matchers are `@testing-library/jest-dom`'s.
- Real events only: `await locator.click()`, `await userEvent.keyboard('{ArrowRight}')`, typing into the editor through `userEvent.keyboard` after focusing the ProseMirror node. A double-click bug in the components library only ever passed under synthetic events.
- Prefer accessible queries (`getByRole('toolbar')`, `getByRole('button', { name })`, `getByRole('menu')`, `getByRole('dialog')`) over test ids.
- The ProseMirror content node is `.ProseMirror[contenteditable]`; read the document back through the component's `content` binding or the hidden input rather than the DOM.
