# `@thomasfosterau/prosekit-svelte`

Svelte 5 rich-text editing on [ProseKit](https://prosekit.dev): `Editor`, `BlockEditor`, `InlineEditor`, a declarative `BlockToolbar` with an insert menu, and link and image dialogs. Built on [bits-ui](https://bits-ui.com), styled with daisyUI's semantic classes, every user-facing string a prop with an English default.

## Installation

```sh
pnpm add @thomasfosterau/prosekit-svelte prosekit @prosekit/pm
```

| Package | Range | Why |
| --- | --- | --- |
| `svelte` | `^5.30.1` | Declared peer. The components are compiled by your build. |
| `prosekit` | `^0.23.0` | Declared peer. The editor runtime and the two stylesheets `Editor.svelte` imports. |
| `@prosekit/pm` | `^0.1.21` | Declared peer. ProseMirror's model and view. |
| `tailwindcss` | `^4.0.0` | **Required**, not a declared peer: the components emit Tailwind classes and ship none. Add the package's `dist/` to Tailwind's `@source` ([setup](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/svelte-editor.md#tailwind-and-daisyui)). |
| `daisyui` | `^5.0.0` | **Required**, not a declared peer: the class vocabulary is daisyUI's. |

`@thomasfosterau/prosekit-utilities` and `bits-ui` are ordinary dependencies and come along automatically.

## Example

```svelte
<script lang="ts">
  import { BlockEditor } from '@thomasfosterau/prosekit-svelte';
  let content = $state();
</script>

<BlockEditor label="Post body" bind:content />
```

Import components by path, never through an always-loaded barrel; `Editor.svelte` carries ProseKit's runtime ([App integration](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/svelte-editor.md#app-integration)).

## Exports

| Export | What it is |
| --- | --- |
| `Editor` | The bare ProseKit mount; everything else is built on it |
| `BlockEditor` | `Editor` on the block-document grammar, with the default toolbar and a hidden form input |
| `InlineEditor` | One line of rich text: marks but no blocks |
| `BlockToolbar`, `SlashMenu` | The default toolbar and its insert menu |
| `LinkDialog`, `ImageDialog` | The link and image prompts, as modals |
| `createDefaultToolbarItems`, `createDefaultSlashCommands`, `ToolbarItem`, `SlashCommand` | The toolbar's data model |
| `setEditorMessages`, `getEditorMessages`, `defaultEditorMessages` | Translatable copy for a subtree |

## Links

- [Svelte editor guide](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/docs/svelte-editor.md): setup, app integration, forms, component reference, the toolbar's data model
- [CHANGELOG](CHANGELOG.md), [CONTRIBUTING](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/CONTRIBUTING.md), [AGENTS.md](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/AGENTS.md), [PUBLISHING](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/PUBLISHING.md), [SECURITY](https://github.com/thomasfosterau/prosekit-utilities/blob/trunk/SECURITY.md)
