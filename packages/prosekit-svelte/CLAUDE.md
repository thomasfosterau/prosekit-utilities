# packages/prosekit-svelte — the editor components

`@thomasfosterau/prosekit-svelte`: the Svelte 5 rich-text editor on ProseKit — `Editor`, `BlockEditor`, `InlineEditor`, the declarative `BlockToolbar` with its insert menu, and the link / image dialogs — built on bits-ui. Everything in `src/lib/` ends up in `dist/` and on npm through `svelte-package`: `svelte-kit sync` generates the ambient types, `svelte-package` copies `src/lib/` compiling nothing, and the consumer's build compiles the `.svelte` files. The repo-wide authoring rules (runes and snippets only, attribute spreading, `class` merging, literal daisyUI lookup tables, bits-ui for interaction, every string a prop, no Effect) live in the root [AGENTS.md](../../AGENTS.md); this file carries what is specific to the package.

## Layout

| Path | What it is |
| --- | --- |
| `src/lib/index.ts` | The barrel. Every public component and helper is exported here, and only from here. |
| `src/lib/editor/` | `Editor`, `BlockEditor`, `InlineEditor`. `Editor.svelte` carries the package's only side-effecting imports, `prosekit/basic/style.css` and `prosekit/basic/typography.css`. |
| `src/lib/toolbar/` | `BlockToolbar`, `SlashMenu`, `LinkDialog`, `ImageDialog`, the item and command types, `createDefaultToolbarItems`, `createDefaultSlashCommands`. |
| `src/lib/messages.svelte.ts` | `EditorMessages`, `defaultEditorMessages`, `setEditorMessages`, `getEditorMessages` — the optional per-render-site copy override. |
| `src/stories/` | Stories, mirroring `src/lib/`. Outside `src/lib/`, so they never ship. |
| `tests/` | The browser suite, one file per component; `tests/setup.ts` registers the jest-dom matchers. |
| `.storybook/` | Storybook 10 config — for the whole workspace, `packages/prosekit-flowchart`'s stories included. `preview.css` is the only place the Tailwind + daisyUI stack is built here. |

Type-checked together: `tsconfig.json`'s `include` is `["src", "tests", ".storybook"]`, so a broken story or test fails `vp run check` exactly like a broken component does.

## Local invariants

- **Stay out of every always-loaded barrel.** `Editor.svelte`'s bare CSS imports mean that whatever imports this package's barrel pulls ProseKit's stylesheets — and, through `createEditor`, the ProseKit runtime, the largest client chunk in the consuming apps — into its chunk. A consumer imports a component from here by path from a route that genuinely edits a document, or through a dynamic `import()` from one that only sometimes does, and never re-exports it from a shared component barrel. The README says so; the app repos enforce it with bundle-boundary tests.
- **`"sideEffects": false`.** Every emitted `.js` is pure declarations; the two CSS lines target modules in another package (`prosekit`), whose own packaging governs their inclusion. This field can only make claims about this package's modules, and those claims hold.
- **The messages context is set per render site, never from a root layout.** Wiring it from the root layout would mean importing this barrel there, which is the leak above. When no provider is mounted (Storybook, tests, an app that never wires it) every string is its English default — silently un-translated, never broken.
- **The toolbar offers only what the editor's extension can hold.** A `ToolbarItem` that runs a command for a node type the schema lacks throws at runtime, so the default item set covers exactly the `defineBlockDocumentExtension()` preset; an app that composes extra nodes adds their items itself.
- **Editors are created once.** `extension` and the initial content are captured by value when the component mounts; reacting to later prop changes would recreate the editor as the user types. `content` is the two-way channel; `defaultContent` seeds without retriggering.
- **The envelope remap is the editor boundary.** Stored documents carry the app's envelope type (`blockDocument`, `inlineDocument`, …); ProseMirror's top node is always `doc`. `BlockEditor` / `InlineEditor` remap in both directions through the core's `toEditorDocument` / `fromEditorDocument`, and the hidden form input always carries the app shape. Feeding the app shape straight into ProseKit throws `RangeError: Unknown node type`.

## Testing

Vitest **browser mode**, headless Chromium through Playwright — not a DOM shim. ProseMirror needs real layout and selection, and this package's contract is focus order, keyboard handling and the accessibility tree.

- `render` comes from `vitest-browser-svelte` and is **async**; assertions go through `expect.element(locator)`, which retries; matchers are `@testing-library/jest-dom`'s.
- Real events only: `await locator.click()`, `await userEvent.keyboard('{ArrowRight}')`, typing into the editor through `userEvent.keyboard` after focusing the ProseMirror node. A double-click bug in the components library only ever passed under synthetic events.
- Prefer accessible queries (`getByRole('toolbar')`, `getByRole('button', { name })`, `getByRole('menu')`, `getByRole('dialog')`) over test ids.
- The ProseMirror content node is `.ProseMirror[contenteditable]`; read the document back through the component's `content` binding or the hidden input rather than the DOM.

## Terms

- **Toolbar item** — `{ id, label, kind?, isActive?, isEnabled?, run }`: one button of `BlockToolbar`. `kind: 'toggle'` renders `aria-pressed` from `isActive`; `run` receives a `ToolbarRunContext` (`editor`, `dialogs.link()`, `dialogs.image()`). A `ToolbarSeparator` (`{ id, separator: true }`) may sit between items.
- **Slash command** — `{ id, label, run }`: one entry of the insert menu (`SlashMenu`, a bits-ui `DropdownMenu` on the toolbar's Insert button). "Slash" is the name the apps used; there is no `/` trigger inside the document.
- **Messages** — `EditorMessages`, one flat record of plain strings: every component label and every default item's label. `createDefaultToolbarItems(messages)` and `createDefaultSlashCommands(messages)` build the default sets from it; component props default to `getEditorMessages()`'s values.
- **Document type** — the `documentType` prop of `BlockEditor` / `InlineEditor`: the envelope name written into the hidden input and stripped on the way in.
