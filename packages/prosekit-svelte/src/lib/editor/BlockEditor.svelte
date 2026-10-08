<!-- @component An `Editor` on the block-document grammar with the default toolbar (`toolbar`, default `true`), the envelope remap (`documentType`, default `'blockDocument'`, ⇄ `doc`) and, given `name`, a hidden form input carrying the document JSON. -->

<!--
  BlockEditor — an `Editor` on the block-document grammar, with the default
  toolbar and a hidden form input.

  Two things it adds over `Editor`.

  The envelope remap. A stored document's root `type` is the application's
  own name for the surface (`blockDocument` by default); a compiled
  ProseMirror schema's top node is always `doc`. This component is that
  boundary, so it remaps in both directions: `defaultContent` is rewritten to
  `doc` on the way in, and the hidden input always carries the application
  shape. Feeding the stored shape straight into ProseKit throws
  `RangeError: Unknown node type: blockDocument` and takes the hosting page
  down with it — the bug both applications this package was extracted from
  hit (#459).

  The hidden input. Given a `name`, the editor is a progressive-enhancement
  form field: the JSON of the current document, in the application's shape,
  posts with the form.

  `toolbar` is one prop carrying both halves of the design: `true` (the
  default) renders `BlockToolbar`, `false` renders none, and a snippet —
  which is what `{#snippet toolbar()}` on the call site passes — replaces it.
-->
<script lang="ts">
  import {
    fromEditorDocument,
    toEditorDocument,
    type NodeJSON,
  } from '@thomasfosterau/prosekit-utilities';
  import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import type { Extension } from 'prosekit/core';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import BlockToolbar from '../toolbar/BlockToolbar.svelte';
  import type { SlashCommand, ToolbarItem, ToolbarSeparator } from '../toolbar/items.ts';
  import EditorMount from './Editor.svelte';

  // The wrapper's native attributes (`id`, `data-*`, `aria-*`, …) pass
  // through to `Editor`, which spreads them on its `<div>`. `children` is
  // omitted and redeclared, and `aria-label` / `aria-labelledby` omitted
  // because `label` owns the accessible name, for the reasons `Editor` gives.
  interface Props
    extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'aria-label' | 'aria-labelledby'> {
    /**
     * The grammar. Omitted, `defineBlockDocumentExtension()` — built lazily,
     * so an application passing its own never constructs the default.
     */
    extension?: Extension | undefined;
    /** The envelope `type` of the stored document. */
    documentType?: string | undefined;
    /** Two-way bound current content, in editor (`doc`) shape. */
    content?: NodeJSON | undefined;
    /** Content the editor is created with, in either shape. */
    defaultContent?: NodeJSON | undefined;
    /** Form field name. Given one, a hidden input carries the document's JSON. */
    name?: string | undefined;
    /** The toolbar's items. Passed to the default `BlockToolbar`. */
    items?: ReadonlyArray<ToolbarItem | ToolbarSeparator> | undefined;
    /** The insert menu's entries. Passed to the default `BlockToolbar`. */
    slashCommands?: ReadonlyArray<SlashCommand> | undefined;
    /** `true` for the default toolbar, `false` for none, a snippet to replace it. */
    toolbar?: boolean | Snippet<[]> | undefined;
    /** Accessible name of the wrapper. */
    label?: string | undefined;
    /** Extra classes on the wrapper. */
    class?: string | undefined;
    /** Rendered after the toolbar, inside the editor's provider. */
    children?: Snippet<[]> | undefined;
  }

  let {
    extension,
    documentType = 'blockDocument',
    content = $bindable(),
    defaultContent,
    name,
    items,
    slashCommands,
    toolbar = true,
    label,
    class: className,
    children,
    ...rest
  }: Props = $props();

  // Built here rather than in the prop default so an application that passes
  // its own extension never constructs the stock one, and so the grammar is
  // captured once — `Editor` creates its editor once for the same reason.
  // svelte-ignore state_referenced_locally
  const resolvedExtension = extension ?? defineBlockDocumentExtension();

  const toStored = $derived(fromEditorDocument(documentType));

  const editorDefaultContent = $derived(
    defaultContent === undefined ? undefined : toEditorDocument(defaultContent),
  );

  const serialised = $derived.by(() => {
    const current = content ?? defaultContent;
    return current === undefined ? undefined : JSON.stringify(toStored(current));
  });
</script>

<EditorMount
  {...rest}
  bind:content
  extension={resolvedExtension}
  defaultContent={editorDefaultContent}
  {label}
  class={className}
>
  {#if toolbar === true}
    <BlockToolbar {items} {slashCommands} />
  {:else if typeof toolbar === 'function'}
    {@render toolbar()}
  {/if}
  {#if children}
    {@render children()}
  {/if}
</EditorMount>

{#if name !== undefined && serialised !== undefined}
  <input type="hidden" {name} value={serialised} />
{/if}
