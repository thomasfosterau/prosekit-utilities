<!-- @component The ProseKit editor mount: `content` binds two-way, `defaultContent` seeds once, and `children` (a toolbar) renders inside the editor context. Importing it pulls in ProseKit's runtime and stylesheets. -->

<!--
  Editor — the ProseKit mount, and this package's only side-effecting
  imports.

  `prosekit/basic/style.css` and `prosekit/basic/typography.css` are bare
  imports in another package's module graph, so the `"sideEffects": false`
  this package declares about its own emitted modules still holds. What they
  do mean is that anything importing this component pulls ProseKit's
  stylesheets — and, through `createEditor`, the ProseKit runtime — into its
  chunk. Import it by path from a route that genuinely edits a document, or
  through a dynamic `import()` from one that only sometimes does, and never
  re-export it from a barrel an application loads on every page.

  The wrapper is a `role="group"` only when `label` is given: a group with no
  accessible name is noise in the accessibility tree, and the thing that
  matters — the `contenteditable` textbox ProseMirror builds — is named by
  the application either way. `children` renders inside `<ProseKit>`, after
  the mount node, which is where a toolbar goes: it needs the editor context
  the provider sets.
-->
<script lang="ts" generics="E extends import('prosekit/core').Extension">
  import 'prosekit/basic/style.css';
  import 'prosekit/basic/typography.css';
  import type { NodeJSON } from '@thomasfosterau/prosekit-utilities';
  import { createEditor, type NodeJSON as ProseKitNodeJSON } from 'prosekit/core';
  import { ProseKit, useDocChange } from 'prosekit/svelte';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  // `children` is omitted and redeclared because Svelte's own
  // `HTMLAttributes` writes it `children?: Snippet` — legal only without
  // `exactOptionalPropertyTypes`, which this workspace compiles with.
  // `aria-label` and `aria-labelledby` are omitted because `label` owns the
  // wrapper's accessible name: the markup sets `aria-label` after the spread
  // and clears `aria-labelledby`, which would otherwise outrank it.
  interface Props
    extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'aria-label' | 'aria-labelledby'> {
    /** The grammar and behaviour this editor is built from. */
    extension: E;
    /** Two-way bound current content; reflects user edits. */
    content?: NodeJSON | undefined;
    /**
     * Content the editor is created with. Decoupled from `content` so an
     * update form can pre-populate without retriggering editor recreation as
     * the user types.
     */
    defaultContent?: NodeJSON | undefined;
    /** Accessible name of the wrapper. Omitted, the wrapper has no role. */
    label?: string | undefined;
    /** Extra classes on the wrapper. */
    class?: string | undefined;
    /** Rendered inside the provider, before the mount node — the toolbar's place. */
    children?: Snippet<[]> | undefined;
  }

  let {
    extension,
    content = $bindable(),
    defaultContent,
    label,
    class: className,
    children,
    ...rest
  }: Props = $props();

  // The editor is created once. `extension` and the initial content are
  // captured by value on purpose — reacting to later prop changes would
  // recreate the editor as the user types (see `defaultContent` above).
  // svelte-ignore state_referenced_locally
  const initialContent = defaultContent ?? content;
  // svelte-ignore state_referenced_locally
  const editor = createEditor({
    extension,
    // The library's `NodeJSON` is the deeply-readonly twin of ProseKit's; the
    // value is the same object either way, and `createEditor` only reads it.
    ...(initialContent !== undefined && {
      defaultContent: initialContent as ProseKitNodeJSON,
    }),
  });

  // `useDocChange` returns its dispose function, which `$effect` re-uses as
  // the cleanup — ProseKit's hooks are not Svelte-aware, so this is the
  // wiring that unsubscribes the document listener on unmount.
  $effect(() => useDocChange(() => (content = editor.getDocJSON()), { editor }));
</script>

<div
  {...rest}
  role={label === undefined ? undefined : 'group'}
  aria-label={label}
  aria-labelledby={undefined}
  class={['flex flex-col gap-2', className]}
>
  <ProseKit {editor}>
    {#if children}
      {@render children()}
    {/if}
    <div {@attach editor.mount} class="outline-solid p-4"></div>
  </ProseKit>
</div>
