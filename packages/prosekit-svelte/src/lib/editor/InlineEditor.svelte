<!-- @component A single-line `Editor` on the inline-document grammar (Enter is a no-op), with the same envelope remap and hidden form input as `BlockEditor`. -->

<!--
  InlineEditor — an `Editor` on the inline-document grammar: one line of
  rich text, marks but no blocks.

  It carries the same envelope remap and hidden form input as `BlockEditor`
  (the applications this package was extracted from had the remap on the
  block editor only, and a separate `InlineEditorInput` wrapper for the
  field; both are folded in here), and one thing of its own: **Enter is a
  no-op**. An inline document's top node is `inline*`, so there is no second
  block for Enter to make; without the binding the base keymap's Enter runs
  against a document that cannot hold its result, and a field that looks like
  a single-line input behaves like a textarea.

  That binding lives in the DEFAULT extension. An application passing its own
  `extension` owns the single-line semantics too — union
  `defineKeymap({ Enter: () => true })` into it, or accept the base keymap's
  behaviour.
-->
<script lang="ts">
  import {
    fromEditorDocument,
    toEditorDocument,
    type NodeJSON,
  } from '@thomasfosterau/prosekit-utilities';
  import { defineInlineDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import { defineKeymap, union, type Extension } from 'prosekit/core';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import EditorMount from './Editor.svelte';

  // The wrapper's native attributes (`id`, `data-*`, `aria-*`, …) pass
  // through to `Editor`, which spreads them on its `<div>`. `children` is
  // omitted and redeclared, and `aria-label` / `aria-labelledby` omitted
  // because `label` / `labelledBy` own the accessible name, for the reasons
  // `Editor` gives.
  interface Props
    extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'aria-label' | 'aria-labelledby'> {
    /**
     * The grammar. Omitted, `defineInlineDocumentExtension()` plus the
     * Enter binding — built lazily, so an application passing its own never
     * constructs the default.
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
    /** Accessible name of the wrapper. */
    label?: string | undefined;
    /**
     * The `id` (or space-separated `id`s) of the visible element that names
     * the wrapper, rendered as `aria-labelledby`. Wins over `label`, which
     * stays the fallback name if no element has the id.
     */
    labelledBy?: string | undefined;
    /** Extra classes on the wrapper. */
    class?: string | undefined;
    /** Rendered inside the editor's provider, after the mount node. */
    children?: Snippet<[]> | undefined;
  }

  let {
    extension,
    documentType = 'inlineDocument',
    content = $bindable(),
    defaultContent,
    name,
    label,
    labelledBy,
    class: className,
    children,
    ...rest
  }: Props = $props();

  // Returning `true` claims the key: ProseKit runs the most recently added
  // keymap first, so this shadows the base keymap's Enter rather than racing
  // it.
  // svelte-ignore state_referenced_locally
  const resolvedExtension =
    extension ?? union(defineInlineDocumentExtension(), defineKeymap({ Enter: () => true }));

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
  {labelledBy}
  class={className}
>
  {#if children}
    {@render children()}
  {/if}
</EditorMount>

{#if name !== undefined && serialised !== undefined}
  <input type="hidden" {name} value={serialised} />
{/if}
