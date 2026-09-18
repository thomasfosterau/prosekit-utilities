<!--
  BlockToolbar — the editor's toolbar, rendered from a list of items.

  ARIA and keyboard contract: bits-ui's `Toolbar`. `role="toolbar"`, one tab
  stop for the whole toolbar, arrow keys to move between items (wrapping),
  Home and End to the ends, and disabled items skipped. The applications this
  package was extracted from had `role="toolbar"` and an accessible name and
  nothing else — every button was a tab stop, and the "active" state of a
  toggle was a CSS class with no `aria-pressed` behind it. That is what the
  browser suite pins here.

  What is local: `aria-pressed` for `kind: 'toggle'` items, read from the
  item's own `isActive` on every editor update (hence `useEditor({ update:
  true })`); `disabled` from `isEnabled`; the separators; and pulling focus
  back into the document after a command runs, so typing continues where it
  left off. A run that opens a dialog says so through `dialogs`, and the
  refocus is skipped — otherwise it would fire before the dialog's focus trap
  and steal the focus straight back.

  The dialogs are rendered here rather than by each item because an item is a
  plain value with no markup of its own; `ToolbarRunContext.dialogs` is the
  seam. The link dialog is seeded from the selection's own link mark, so the
  button edits an existing link instead of silently replacing it.

  Every class is a literal: Tailwind only generates what it can read in
  source, so `btn-${something}` would emit nothing at build time.
-->
<script lang="ts">
  import { Toolbar } from 'bits-ui';
  import { getMarkRange } from 'prosekit/core';
  import { useEditor } from 'prosekit/svelte';
  import { getEditorMessages } from '../messages.svelte.ts';
  import ImageDialog from './ImageDialog.svelte';
  import {
    createDefaultSlashCommands,
    createDefaultToolbarItems,
    isToolbarSeparator,
    type SlashCommand,
    type ToolbarEditor,
    type ToolbarItem,
    type ToolbarRunContext,
    type ToolbarSeparator,
  } from './items.ts';
  import LinkDialog from './LinkDialog.svelte';
  import SlashMenu from './SlashMenu.svelte';

  interface Props {
    /** The buttons and separators, in order. */
    items?: ReadonlyArray<ToolbarItem | ToolbarSeparator> | undefined;
    /** The insert menu's entries. */
    slashCommands?: ReadonlyArray<SlashCommand> | undefined;
    /** Accessible name of the toolbar. */
    label?: string | undefined;
    /** Visible text and accessible name of the insert button. */
    insertLabel?: string | undefined;
    /** Accessible name of the open insert menu. */
    insertMenuLabel?: string | undefined;
    /** Label overrides for the link dialog. */
    linkDialog?: Partial<LinkDialogLabels> | undefined;
    /** Label overrides for the image dialog. */
    imageDialog?: Partial<ImageDialogLabels> | undefined;
    /** Extra classes on the toolbar. */
    class?: string | undefined;
  }

  /** The label props `BlockToolbar` forwards to `LinkDialog`. */
  interface LinkDialogLabels {
    titleLabel: string;
    hrefLabel: string;
    linkTitleLabel: string;
    submitLabel: string;
    removeLabel: string;
    cancelLabel: string;
    closeLabel: string;
    invalidHrefMessage: string;
  }

  /** The label props `BlockToolbar` forwards to `ImageDialog`. */
  interface ImageDialogLabels {
    titleLabel: string;
    srcLabel: string;
    submitLabel: string;
    cancelLabel: string;
    closeLabel: string;
    invalidSrcMessage: string;
  }

  const messages = getEditorMessages();

  let {
    items = createDefaultToolbarItems(messages),
    slashCommands = createDefaultSlashCommands(messages),
    label = messages.toolbarLabel,
    insertLabel = messages.insertLabel,
    insertMenuLabel = messages.insertMenuLabel,
    linkDialog,
    imageDialog,
    class: className,
  }: Props = $props();

  const editorStore = useEditor({ update: true });

  const BUTTON_CLASS = 'btn btn-sm btn-ghost border-base-300 border';
  const PRESSED_CLASS = 'btn-active';

  let linkOpen = $state(false);
  let imageOpen = $state(false);
  let linkSeed = $state<{ href: string; title: string }>({ href: '', title: '' });

  /**
   * Reads the link mark touching the caret, so the dialog opens on the link
   * the user is standing in rather than blank over the top of it. Guarded on
   * the schema: an application may use these items with a grammar that has
   * no link mark, and `getMarkRange` would throw for it.
   */
  function currentLink(editor: ToolbarEditor): { href: string; title: string } {
    if (editor.schema.marks['link'] === undefined) return { href: '', title: '' };
    const range = getMarkRange(editor.state.selection.$from, 'link');
    const attrs = (range?.mark.attrs ?? {}) as Record<string, unknown>;
    return {
      href: typeof attrs['href'] === 'string' ? attrs['href'] : '',
      title: typeof attrs['title'] === 'string' ? attrs['title'] : '',
    };
  }

  /** Tracks whether the run just performed asked for a dialog. */
  let opening = false;

  const dialogs: ToolbarRunContext['dialogs'] = {
    link: () => {
      opening = true;
      linkSeed = currentLink($editorStore);
      linkOpen = true;
    },
    image: () => {
      opening = true;
      imageOpen = true;
    },
  };

  function run(item: ToolbarItem): void {
    opening = false;
    item.run({ editor: $editorStore, dialogs });
    if (!opening) $editorStore.focus();
  }

  function applyLink(attrs: { href: string; title: string | null }): void {
    const editor: ToolbarEditor = $editorStore;
    // ProseKit's stock `link` mark declares `href`, `target` and `rel`; a
    // `title` reaches `addLink` for a grammar whose link mark declares one
    // and is dropped by `computeAttrs` for one that does not.
    editor.commands['addLink']?.(attrs);
    editor.focus();
  }

  function removeLink(): void {
    const editor: ToolbarEditor = $editorStore;
    editor.commands['removeLink']?.();
    editor.focus();
  }

  function insertImage(attrs: { src: string }): void {
    const editor: ToolbarEditor = $editorStore;
    editor.commands['insertNode']?.({ type: 'image', attrs });
    editor.focus();
  }
</script>

<Toolbar.Root
  aria-label={label}
  class={[
    'border-base-300 bg-base-100 flex flex-wrap items-center gap-1.5 rounded border p-2',
    className,
  ]}
>
  {#each items as item (item.id)}
    {#if isToolbarSeparator(item)}
      <div role="separator" aria-orientation="vertical" class="bg-base-300 mx-1 h-5 w-px"></div>
    {:else}
      <Toolbar.Button
        disabled={item.isEnabled === undefined ? false : !item.isEnabled($editorStore)}
        aria-pressed={item.kind === 'toggle'
          ? (item.isActive?.($editorStore) ?? false)
          : undefined}
        class={[
          BUTTON_CLASS,
          item.kind === 'toggle' && item.isActive?.($editorStore) === true && PRESSED_CLASS,
        ]}
        onclick={() => run(item)}
      >
        {item.label}
      </Toolbar.Button>
    {/if}
  {/each}

  <SlashMenu
    commands={slashCommands}
    label={insertLabel}
    menuLabel={insertMenuLabel}
    {dialogs}
  >
    {#snippet trigger({ props })}
      <Toolbar.Button {...props} class={BUTTON_CLASS}>{insertLabel}</Toolbar.Button>
    {/snippet}
  </SlashMenu>
</Toolbar.Root>

<LinkDialog
  bind:open={linkOpen}
  href={linkSeed.href}
  title={linkSeed.title}
  onSubmit={applyLink}
  onRemove={removeLink}
  {...linkDialog}
/>

<ImageDialog bind:open={imageOpen} onSubmit={insertImage} {...imageDialog} />
