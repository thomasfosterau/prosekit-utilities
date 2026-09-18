# `@thomasfosterau/prosekit-svelte`

Svelte 5 rich-text editing on [ProseKit](https://prosekit.dev): `Editor`, `BlockEditor`, `InlineEditor`, a declarative `BlockToolbar` with an insert menu, and the link and image dialogs — all built on [bits-ui](https://bits-ui.com), all styled with daisyUI's semantic classes, every user-facing string a prop with an English default.

Four rules hold across every component:

- **daisyUI semantic classes, never raw colour.** `btn`, `menu`, `modal-box`, `input`, `bg-base-100`, `text-error` — never a hex or an `oklch()`. Variant classes come from literal lookup tables, never a template string (Tailwind only emits classes it can see spelled out).
- **bits-ui owns interaction.** `Toolbar` for the roving focus model, `DropdownMenu` for the insert menu, `Dialog` for the two prompts. Nothing with focus management, keyboard semantics or an ARIA relationship between elements is hand-rolled.
- **Every user-facing string is a prop with an English default.** Accessible-name props end in `Label`; item labels are data in the toolbar spec. `setEditorMessages` is an optional second layer that changes those defaults per render site.
- **No Effect.** Optional values are `T | undefined`; callbacks are plain functions. `effect` is not a dependency of this package.

Every component spreads the native attributes of the element it renders and merges the caller's `class` last, so nothing here swallows an `id`, an `aria-*` attribute or a `data-*` hook.

## Installation

```sh
pnpm add @thomasfosterau/prosekit-svelte prosekit @prosekit/pm
```

### Peer requirements

| Package | Range | Why |
| --- | --- | --- |
| `svelte` | `^5.30.1` | A declared peer. The components are compiled by your build, not pre-compiled. |
| `prosekit` | `^0.22.2` | A declared peer. The editor runtime, and the two stylesheets `Editor.svelte` imports. |
| `@prosekit/pm` | `^0.1.19` | A declared peer. ProseMirror's model and view, at the version ProseKit expects. |
| `tailwindcss` | `^4.0.0` | Not a declared peer, but **required**: the components emit Tailwind classes and ship none. |
| `daisyui` | `^5.0.0` | Same — the class vocabulary is daisyUI's (`btn`, `menu`, `modal-box`, `input`, `bg-base-100`). |

Tailwind 4 has no `tailwind.config.js`, so wire it up from your CSS entry. The `@source` line is what makes Tailwind scan this package's `dist/` and emit the classes it asks for; without it the editor renders unstyled.

```css
@import 'tailwindcss';
@source '../node_modules/@thomasfosterau/prosekit-svelte/dist';
@plugin "daisyui" {
  themes:
    light --default,
    dark --prefersdark;
}
```

ProseKit's own stylesheets arrive through `Editor.svelte`'s bare imports — you do not import them yourself.

`@thomasfosterau/prosekit-utilities` and `bits-ui` are ordinary dependencies of this package, at the same release line, and come along automatically when you install it — you do not add either yourself.

## App integration

**Import by path, never re-export from a shared component barrel.** `Editor.svelte` imports `prosekit/basic/style.css` and `prosekit/basic/typography.css` at the top level, and through `createEditor` it pulls the ProseKit runtime behind them — the largest client chunk in the applications this package was extracted from. Whatever module imports this package carries all of that in its chunk, so a route that genuinely edits a document imports a component directly:

```svelte
<!-- A route that genuinely edits a document -->
<script lang="ts">
  import { BlockEditor } from '@thomasfosterau/prosekit-svelte';
</script>
```

and a route that only sometimes edits one reaches it behind a dynamic `import()`:

```svelte
{#await import('@thomasfosterau/prosekit-svelte') then { BlockEditor }}
  <BlockEditor name="body" {defaultContent} />
{/await}
```

Never re-export a component from an **application-wide** component barrel (`$lib/components/index.ts` or similar) and never wire the messages context from a root layout — both put the editor's CSS and runtime into every page's shared chunk. `"sideEffects": false` lets a bundler tree-shake the rest of this package's exports away from a route that only imports one component, but only if nothing else in the bundle reaches this package through a barrel that is itself always loaded.

### The messages context

Every string is already a prop, so a single call site needs nothing here. `setEditorMessages(partial)` is for an application that mounts the editor from several places and would rather not thread twenty props through each: it changes the _defaults_ for one subtree, merged over the English ones, and a caller's own prop still wins.

Call it **per render site** — from the component that mounts the editor, for the reason above — never from a root layout.

```svelte
<!-- PostBodyField.svelte -->
<script lang="ts">
  import { BlockEditor, setEditorMessages } from '@thomasfosterau/prosekit-svelte';
  import * as m from '$lib/paraglide/messages';

  setEditorMessages({
    toolbarLabel: m.editor_toolbar(),
    bold: m.editor_bold(),
    slashParagraph: m.editor_slash_paragraph(),
  });
</script>

<BlockEditor name="body" label={m.post_body()} />
```

With no provider mounted — Storybook, a test, an application that never wires it — every string is its English default. That is the documented normal case, not an error.

### Forms

Given a `name`, `BlockEditor` and `InlineEditor` emit a hidden input carrying the current document as JSON, in the **application's** envelope shape (`{"type":"blockDocument",…}`), so the field posts with the form and decodes with the shape your document schema declares. `documentType` names the envelope; the components remap to and from ProseMirror's `doc` shape at the boundary in both directions.

A worked example: a form field that composes an app extension and an app toolbar item, and the server action that reads the field back.

```svelte
<!-- BlockEditorField.svelte -->
<script lang="ts">
  import { BlockEditor, createDefaultToolbarItems, type ToolbarItem } from '@thomasfosterau/prosekit-svelte';
  import type { NodeJSON } from '@thomasfosterau/prosekit-utilities';
  import { blockExtension } from '$lib/server/document-schema.ts';

  interface Props {
    defaultContent?: NodeJSON | undefined;
  }
  let { defaultContent }: Props = $props();

  const myItem: ToolbarItem = {
    id: 'sidenote',
    label: 'Sidenote',
    kind: 'toggle',
    isActive: (editor) => editor.nodes['sidenote']?.isActive() ?? false,
    run: ({ editor }) => void editor.commands['insertNode']?.({ type: 'sidenote' }),
  };
</script>

<form method="post" action="?/save">
  <BlockEditor
    name="content"
    extension={blockExtension}
    {defaultContent}
    items={[...createDefaultToolbarItems(), myItem]}
  />
  <button type="submit">Save</button>
</form>
```

```ts
// +page.server.ts — reading the hidden input's JSON back with the core's DocumentSchema.decode
import * as Effect from 'effect/Effect';
import { blockDocumentSchema } from '$lib/server/document-schema.ts';

export const actions = {
  save: async ({ request }) => {
    const form = await request.formData();
    const raw: unknown = JSON.parse(String(form.get('content')));

    // decode: (v: unknown) => Effect.Effect<DocumentJSON<'blockDocument'>, DocumentDecodeError>
    const body = await Effect.runPromise(
      blockDocumentSchema
        .decode(raw)
        .pipe(Effect.catchTag('DocumentDecodeError', (error) => Effect.die(error))),
    );

    // … persist `body`.
  },
};
```

`blockDocumentSchema` here is the `DocumentSchema` a server module builds with `@thomasfosterau/prosekit-utilities/prosekit`'s `defineDocumentSchema` — see that package's README for `decode`'s full signature and its `DocumentDecodeError` channel. Feeding the stored envelope straight into ProseKit instead of through this boundary throws `RangeError: Unknown node type`.

# Editors

| Component | Purpose | Props | Snippets | ARIA |
| --- | --- | --- | --- | --- |
| `Editor<E extends Extension>` | The bare ProseKit mount; everything else in this package is built on it | `extension: E`, `content?: NodeJSON` (bindable), `defaultContent?: NodeJSON`, `label?`, `class?` + `HTMLAttributes<HTMLDivElement>` | `children?` — rendered inside `<ProseKit>`, **before** the mount node, which is where a toolbar goes | wrapper `role="group"` + `aria-label` only when `label` is given; the content is ProseMirror's `.ProseMirror[contenteditable]` node, whose keyboard model is the extension's |
| `BlockEditor` | `Editor` on the block-document grammar, with the default toolbar, the envelope remap and a hidden form input | `extension?` (default `defineBlockDocumentExtension()`, built lazily), `documentType? = 'blockDocument'`, `content?` (bindable), `defaultContent?` (either shape), `name?`, `items?: ReadonlyArray<ToolbarItem \| ToolbarSeparator>`, `slashCommands?: ReadonlyArray<SlashCommand>`, `toolbar? = true` (`false` renders none, a snippet replaces the default), `label?`, `class?` | `toolbar?` — replaces the default `BlockToolbar`; `children?` — rendered after it | as `Editor`. Feeding a stored (`blockDocument`-typed) document straight into ProseKit throws `RangeError: Unknown node type`; this component is the boundary that stops that |
| `InlineEditor` | One line of rich text: marks but no blocks | `extension?` (default `defineInlineDocumentExtension()` plus the Enter binding), `documentType? = 'inlineDocument'`, `content?` (bindable), `defaultContent?` (either shape), `name?`, `label?`, `class?` | `children?` — rendered inside the provider, before the mount node | as `Editor`; **Enter is a no-op** — an inline document's top node is `inline*`, so there is no second block for it to make. The binding lives in the default extension; supply your own `extension` and you own the single-line semantics too |

```svelte
<script lang="ts">
  import { BlockEditor } from '@thomasfosterau/prosekit-svelte';
  let content = $state();
</script>

<BlockEditor label="Post body" bind:content />
```

# Toolbar

| Component | Purpose | Props | Snippets | ARIA |
| --- | --- | --- | --- | --- |
| `BlockToolbar` | The default toolbar, rendered from a list of items | `items? = createDefaultToolbarItems(messages)`, `slashCommands? = createDefaultSlashCommands(messages)`, `label? = 'Editor toolbar'`, `insertLabel? = 'Insert'`, `insertMenuLabel? = 'Insert block'`, `linkDialog?: Partial<LinkDialogLabels>` (forwarded to `LinkDialog`), `imageDialog?: Partial<ImageDialogLabels>` (forwarded to `ImageDialog`), `class?` | — (must be rendered inside an `Editor`; it reads the editor from ProseKit's context) | bits-ui `Toolbar.Root`: `role="toolbar"` named by `label`, one tab stop, arrow keys move and wrap, Home/End to the ends, disabled items skipped; `kind: 'toggle'` items carry `aria-pressed` from `isActive` on every editor update; separators are `role="separator"` + `aria-orientation="vertical"` and not a keyboard stop; after a run, focus returns to the document unless the run opened a dialog |
| `SlashMenu` | The insert menu, exported for a toolbar of your own | `commands: ReadonlyArray<SlashCommand>`, `open?` (bindable, default `false`), `label? = 'Insert'`, `menuLabel? = 'Insert block'`, `dialogs?: ToolbarRunContext['dialogs']` (omitted, `dialogs.link()` / `dialogs.image()` do nothing), `class?` | `trigger?({ props })` — your own opening control, spreading `props`; omitted, a daisyUI `btn` labelled `label` | bits-ui `DropdownMenu`: `aria-haspopup="menu"` + `aria-expanded` on the trigger, `role="menu"` on the content (named by `menuLabel`), `role="menuitem"` per entry, arrow keys, typeahead, Escape closes and returns focus to the trigger — or to the document after a choice, unless the command opened a dialog |
| `LinkDialog` | The link prompt, as a modal | `open?` (bindable), `href? = ''` (re-read on every open), `title? = ''`, `onSubmit: (attrs: { href: string; title: string \| null }) => void` (required), `onRemove?` (omitted, no remove button), `titleLabel? = 'Link'`, `hrefLabel? = 'URL'`, `linkTitleLabel? = 'Title (optional)'`, `submitLabel? = 'Apply'`, `removeLabel? = 'Remove link'`, `cancelLabel? = 'Cancel'`, `closeLabel? = 'Close'`, `invalidHrefMessage? = 'Enter an http, https or mailto URL.'`, `class?` | — | bits-ui `Dialog`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` wired to the title, focus trap, Escape, scroll lock, focus return; a URL that fails `isSafeHref` is refused in a `role="alert"` with `aria-invalid` + `aria-describedby` on the field; the fields are in a `<form>`, so Enter submits |
| `ImageDialog` | The image prompt, as a modal | `open?` (bindable), `src? = ''`, `onSubmit: (attrs: { src: string }) => void` (required), `titleLabel? = 'Image'`, `srcLabel? = 'Image URL'`, `submitLabel? = 'Insert'`, `cancelLabel? = 'Cancel'`, `closeLabel? = 'Close'`, `invalidSrcMessage? = 'Enter an http, https or mailto URL.'`, `class?` | — | as `LinkDialog` |

`BlockToolbar` renders `LinkDialog` and `ImageDialog` itself and opens them through `ToolbarRunContext.dialogs`; the link dialog is seeded from the selection's own link mark, so its button edits an existing link rather than replacing it, and its remove button runs `removeLink`.

## The toolbar's data model

`BlockToolbar` renders a list rather than a hard-coded row of buttons — an application appends its own item, reorders, drops one, or passes a list of its own making.

```ts
/** The editor as an item sees it: any grammar, `commands` / `nodes` / `marks` read by name. */
type ToolbarEditor = Omit<Editor<any>, 'commands' | 'marks' | 'nodes'> & {
  readonly commands: Record<string, CommandAction>;
  readonly marks: Record<string, MarkAction>;
  readonly nodes: Record<string, NodeAction>;
};

interface ToolbarRunContext {
  readonly editor: ToolbarEditor;
  readonly dialogs: { readonly link: () => void; readonly image: () => void };
}

interface ToolbarItem {
  readonly id: string;
  readonly label: string;
  readonly kind?: ('toggle' | 'action') | undefined; // 'toggle' => aria-pressed from isActive
  readonly isActive?: ((editor: ToolbarEditor) => boolean) | undefined;
  readonly isEnabled?: ((editor: ToolbarEditor) => boolean) | undefined; // false => disabled button
  readonly run: (context: ToolbarRunContext) => void;
}

interface ToolbarSeparator {
  readonly id: string;
  readonly separator: true;
}

interface SlashCommand {
  readonly id: string;
  readonly label: string;
  readonly run: (context: ToolbarRunContext) => void;
}
```

`ToolbarEditor` is not `Editor<any>` because it cannot be: ProseKit derives `commands`, `nodes` and `marks` from the extension's own typing, and the derivation collapses to `never` for `any`, so `editor.commands.toggleBold()` in an item of your own would not compile. A real `Editor<E>` is assignable to `ToolbarEditor`, and naming a command the grammar lacks gets `undefined` rather than a type error.

| Export | Signature | Notes |
| --- | --- | --- |
| `isToolbarSeparator` | `(entry: ToolbarItem \| ToolbarSeparator) => entry is ToolbarSeparator` | Narrows an `items` entry to the separator arm. |
| `createDefaultToolbarItems` | `(messages?: Partial<EditorMessages>) => ReadonlyArray<ToolbarItem \| ToolbarSeparator>` | Nineteen items and two separators, in order: **bold, italic, underline, strike, highlight, subscript, superscript, link** \| **paragraph, heading 2, quote, bullets, numbered, code block, rule, table (3×3), image** \| **undo, redo**. |
| `createDefaultSlashCommands` | `(messages?: Partial<EditorMessages>) => ReadonlyArray<SlashCommand>` | Ten entries, in order: **paragraph, heading 2, blockquote, bullet list, ordered list, todo list, code block, table, image, horizontal rule**. |

Every default `run` goes through the editor's own `commands`, `marks` and `nodes`, so the set works against any extension registering those node and mark types and quietly does nothing against one that does not — the default item set covers exactly `defineBlockDocumentExtension()`'s grammar; an application composing extra nodes adds their items itself. Extending is appending:

```ts
import { createDefaultToolbarItems, type ToolbarItem } from '@thomasfosterau/prosekit-svelte';

const sidenote: ToolbarItem = {
  id: 'sidenote',
  label: 'Sidenote',
  kind: 'toggle',
  isActive: (editor) => editor.nodes['sidenote']?.isActive() ?? false,
  run: ({ editor }) => void editor.commands['insertNode']?.({ type: 'sidenote' }),
};

const items = [...createDefaultToolbarItems(), { id: 'app', separator: true }, sidenote];
```

# Messages

`EditorMessages` is one flat interface of plain strings, grouped here by what they name:

- **Component labels** — `toolbarLabel`, `insertLabel`, `insertMenuLabel`; `linkDialogTitle`, `linkHrefLabel`, `linkTitleLabel`, `linkSubmitLabel`, `linkRemoveLabel`, `linkCancelLabel`, `linkCloseLabel`, `linkInvalidHrefMessage`; `imageDialogTitle`, `imageSrcLabel`, `imageSubmitLabel`, `imageCancelLabel`, `imageCloseLabel`, `imageInvalidSrcMessage`.
- **Default toolbar item labels** — `bold`, `italic`, `underline`, `strike`, `highlight`, `subscript`, `superscript`, `link`, `paragraph`, `heading2`, `quote`, `bullets`, `numbered`, `codeBlock`, `rule`, `table`, `image`, `undo`, `redo`.
- **Default insert-menu labels** — `slashParagraph`, `slashHeading2`, `slashBlockquote`, `slashBulletList`, `slashOrderedList`, `slashTodoList`, `slashCodeBlock`, `slashTable`, `slashImage`, `slashHorizontalRule`.

| Export | Signature | Notes |
| --- | --- | --- |
| `EditorMessages` | One flat interface of plain `string`s | Every component label prop, plus one key per default item and insert-menu entry. |
| `defaultEditorMessages` | `EditorMessages` | The English copy every prop falls back to — the applications this package was extracted from shipped these exact item labels, abbreviations included (`P`, `H2`, `Sub`, `Sup`). The default toolbar draws no icons, so an item's label is both its visible text and its accessible name. |
| `setEditorMessages` | `(messages: Partial<EditorMessages>) => void` | Provides copy for this subtree, merged over the defaults. Per render site, never from a root layout — see [App integration](#app-integration). |
| `getEditorMessages` | `() => EditorMessages` | Reads it, or `defaultEditorMessages` when no provider is mounted. |

The context key is `Symbol.for('@thomasfosterau/prosekit-svelte/messages')` — a registry symbol, so two copies of the module in one bundle still agree.

## Known limits

- ProseKit's stock `link` mark declares `href`, `target` and `rel` only — no `title`. `LinkDialog`'s `title` field reaches `addLink` and survives only for a grammar whose own `link` mark declares one; against the stock mark, ProseMirror's `computeAttrs` silently drops it.
- ProseKit's stock `image` node declares `src`, `width` and `height` only, which is why `ImageDialog` asks for one field, deliberately. The applications this package was extracted from also prompted for alt text, a title and a caption, and `computeAttrs` dropped all three — three prompts collecting text that went nowhere. An application whose image node declares more passes its own toolbar item.

## Testing

Suites run under Vitest **browser mode**, headless Chromium through Playwright, not a DOM shim — ProseMirror needs real layout and selection, and this package's contract is focus order, keyboard handling and the accessibility tree. `render` comes from `vitest-browser-svelte` and is asynchronous; assertions go through `expect.element(locator)`; every interaction is a real event (`locator.click()`, `userEvent.keyboard('{ArrowRight}')`, typing into a focused ProseMirror node) rather than a synthetic one.
