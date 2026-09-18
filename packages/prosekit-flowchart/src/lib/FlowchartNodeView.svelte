<!--
  FlowchartNodeView — the Svelte node view ProseKit mounts for a `flowchart`
  node.

  The preview is the SAME server-renderable SVG a reader page gets
  (`generateFlowchartSvg`, from this package's `./node` entry), so the editor
  and the published article cannot drift, and so the `@xyflow/svelte` bundle
  only loads when the author actually opens the edit dialog.

  ## The one place stores are allowed

  This workspace's Svelte code is runes-only. ProseKit's node-view contract is
  the documented exception: the adapter hands the view a `Writable<Node>` and a
  `Writable<boolean>` plus a `setAttrs` callback, and they are consumed here
  through Svelte's `$store` auto-subscription. Nothing else in this package
  touches a store.
-->
<script lang="ts">
  import type { Attrs, Node as ProseMirrorNode } from '@prosekit/pm/model';
  import type { Writable } from 'svelte/store';
  import FlowchartEditDialog from './FlowchartEditDialog.svelte';
  import { EMPTY_FLOWCHART } from './node/data.ts';
  import type { FlowchartData } from './node/schema.ts';
  import { generateFlowchartSvg } from './node/svg.ts';

  interface Props {
    /** The ProseMirror node this view renders, as ProseKit's store. */
    node: Writable<ProseMirrorNode>;
    /** Whether ProseMirror currently has this node selected. */
    selected: Writable<boolean>;
    /** Writes attributes back onto the node — the save channel. */
    setAttrs: (attrs: Attrs) => void;
    /** The button that opens the edit dialog. */
    editLabel?: string | undefined;
  }

  let { node, selected, setAttrs, editLabel = 'Edit' }: Props = $props();

  // A `bind:this` target, so the declared type must literally be `T |
  // undefined`: Svelte assigns the component instance itself into it, and
  // `undefined` before mount and after unmount.
  let dialog: FlowchartEditDialog | undefined = $state();

  const data = $derived<FlowchartData>(
    ($node.attrs as { data?: FlowchartData }).data ?? EMPTY_FLOWCHART,
  );
  const svg = $derived(generateFlowchartSvg(data));

  function openEditor(): void {
    dialog?.open(data);
  }

  function handleSave(next: FlowchartData): void {
    setAttrs({ data: next });
  }
</script>

<div
  class="flowchart-node-view group relative my-3 rounded border p-2"
  class:border-primary={$selected}
  class:border-base-300={!$selected}
  contenteditable="false"
  data-prosemirror-node-name="flowchart"
>
  <div class="flowchart-preview overflow-hidden">
    <!-- The SVG comes from this package's own escape-aware serialiser
         (`./node/svg.ts`), which XML-escapes every label; it is never
         user-supplied HTML. -->
    {@html svg}
  </div>
  <button
    type="button"
    class="btn btn-xs btn-primary absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
    class:opacity-100={$selected}
    onclick={openEditor}
  >
    {editLabel}
  </button>
</div>

<FlowchartEditDialog bind:this={dialog} initialData={data} onSave={handleSave} />

<style>
  .flowchart-preview :global(svg) {
    max-height: 20rem;
    display: block;
  }
</style>
