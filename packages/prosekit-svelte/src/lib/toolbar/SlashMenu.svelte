<!-- @component The insert menu: a bits-ui `DropdownMenu` of `SlashCommand` entries. `BlockToolbar` renders it; a custom toolbar can too. -->

<!--
  SlashMenu — the insert menu, on bits-ui's `DropdownMenu`.

  "Slash" is the name the applications this package was extracted from used.
  There is no `/` trigger inside the document: this is a button that opens a
  menu of block insertions.

  ARIA contract: bits-ui's. `aria-haspopup="menu"` and `aria-expanded` on the
  trigger, `role="menu"` on the content, `role="menuitem"` on each entry,
  arrow-key roving focus, typeahead, Escape to close and focus return. The
  applications' version was a `role="listbox"` of plain `<button>`s — an
  invalid parent/child pairing — with no `aria-expanded`, no focus
  management and no Escape, which is the whole reason this is a bits-ui
  primitive and not a `{#if}`.

  The daisyUI `menu` styling goes on a `<ul>` INSIDE the content, and that
  list and its `<li>` wrappers carry `role="none"` so the presentation layer
  never comes between `role="menu"` and its items in the accessibility tree.

  `BlockToolbar` renders this with its own `Toolbar.Button` as the trigger,
  so the insert button is a toolbar item like any other. Exported for a
  custom toolbar that wants the same menu.
-->
<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import { useEditor } from 'prosekit/svelte';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { getEditorMessages } from '../messages.svelte.ts';
  import type { SlashCommand, ToolbarRunContext } from './items.ts';

  // The native attributes (`id`, `data-*`, `aria-*`, …) go on the menu
  // element itself, bits-ui's `DropdownMenu.Content` (`role="menu"`), where
  // an `aria-*` attribute means something; on the `role="none"` list it
  // would turn the list back into one and come between the menu and its
  // items. `class` stays on the list, which carries the daisyUI styling.
  // Spread first, so `menuLabel` / `labelledBy` keep owning the accessible
  // name; for the same reason `aria-label` and `aria-labelledby` are left out
  // of the props, and the markup sets both after the spread: an untyped
  // caller's `aria-labelledby`, which would otherwise outrank `aria-label`, is
  // cleared unless `labelledBy` sets it, and given `labelledBy`, `aria-label`
  // is left off (`labelledBy` wins over `menuLabel` and its default; `Editor`
  // says why that is not a union). bits-ui sets no `aria-labelledby` of its
  // own on the menu content. `id` is redeclared without `null`, which
  // bits-ui's primitives do not accept; `dir` is left out: on
  // `DropdownMenu.Content` bits-ui types it as its own `Direction` (no
  // `auto`) and overwrites it with the menu root's `dir`.
  interface Props
    extends Omit<
      HTMLAttributes<HTMLDivElement>,
      'children' | 'class' | 'id' | 'dir' | 'aria-label' | 'aria-labelledby'
    > {
    /** The menu element's `id`. */
    id?: string | undefined;
    /** The entries. */
    commands: ReadonlyArray<SlashCommand>;
    /** Whether the menu is open. Bindable. */
    open?: boolean | undefined;
    /** Visible text and accessible name of the trigger. */
    label?: string | undefined;
    /** Accessible name of the open menu. */
    menuLabel?: string | undefined;
    /**
     * The `id` (or space-separated `id`s) of the visible element that names
     * the open menu, rendered as `aria-labelledby`. Wins over `menuLabel`.
     */
    labelledBy?: string | undefined;
    /**
     * The dialogs a command may ask for. Omitted — a menu mounted outside a
     * toolbar — `dialogs.link()` / `dialogs.image()` do nothing, and a
     * command that calls one is inert rather than broken.
     */
    dialogs?: ToolbarRunContext['dialogs'] | undefined;
    /** Extra classes on the `<ul class="menu">`. */
    class?: string | undefined;
    /** The opening control — the caller's own element, spreading `props`. */
    trigger?: Snippet<[{ props: Record<string, unknown> }]> | undefined;
  }

  const messages = getEditorMessages();

  let {
    commands,
    open = $bindable(false),
    label = messages.insertLabel,
    menuLabel = messages.insertMenuLabel,
    labelledBy,
    dialogs,
    class: className,
    trigger,
    id,
    ...rest
  }: Props = $props();

  // `update: true` so the store re-emits on every editor state change; the
  // commands are read at the moment they run, not captured. ProseKit hands
  // the editor in as a Svelte store — that is its contract, and the one
  // place this package touches one.
  const editorStore = useEditor({ update: true });

  // Set by `select`, read by `onCloseAutoFocus` below. Closing is what moves
  // focus, and it happens after the handler returns.
  let returnFocusToEditor = false;

  function select(command: SlashCommand): void {
    let opening = false;
    command.run({
      editor: $editorStore,
      dialogs: {
        link: () => {
          opening = true;
          dialogs?.link();
        },
        image: () => {
          opening = true;
          dialogs?.image();
        },
      },
    });
    // Pulling focus back into the document is right after an insertion and
    // wrong when a dialog is opening: it would take focus off the dialog
    // before its trap is set up.
    returnFocusToEditor = !opening;
  }

  /**
   * Redirects bits-ui's focus return.
   *
   * On close it puts focus back on the trigger, which is right for Escape
   * and wrong after an insertion — the caret belongs where the block just
   * landed. Preventing the default and focusing the document is the
   * primitive's own seam for exactly this.
   */
  function closeAutoFocus(event: Event): void {
    if (!returnFocusToEditor) return;
    returnFocusToEditor = false;
    event.preventDefault();
    $editorStore.focus();
  }
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      {#if trigger}
        {@render trigger({ props })}
      {:else}
        <button {...props} type="button" class="btn btn-sm btn-ghost border-base-300 border">
          {label}
        </button>
      {/if}
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      {...rest}
      {...(id === undefined ? {} : { id })}
      side="bottom"
      align="start"
      sideOffset={6}
      aria-label={labelledBy === undefined ? menuLabel : undefined}
      aria-labelledby={labelledBy}
      onCloseAutoFocus={closeAutoFocus}
      class="z-50"
    >
      <ul role="none" class={['menu bg-base-100 rounded-box w-56 p-2 shadow-md', className]}>
        {#each commands as command (command.id)}
          <li role="none">
            <DropdownMenu.Item onSelect={() => select(command)}>
              {#snippet child({ props })}
                <button {...props} type="button">{command.label}</button>
              {/snippet}
            </DropdownMenu.Item>
          </li>
        {/each}
      </ul>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
