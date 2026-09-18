<!--
  Plays the caller that opens a `FlowchartEditDialog` imperatively.

  The bindable `open` prop covers the declarative path, and a `.ts` test can
  pass that directly; this fixture exists for the OTHER entry point — the
  `open(data)` instance method the ProseKit node view uses, which needs a
  `bind:this` and therefore a template. It also publishes the bound `open`
  state, so a test can tell "the dialog closed" from "the content merely
  unmounted".
-->
<script lang="ts">
  import FlowchartEditDialog from '../../src/lib/FlowchartEditDialog.svelte';
  import type { FlowchartData } from '../../src/lib/node/schema.ts';

  interface Props {
    /** The dialog's fallback payload. */
    initialData?: FlowchartData | undefined;
    /** What the "Open with payload" button hands `open(data)`. */
    openWith?: FlowchartData | undefined;
    /** Passed straight through. */
    onSave: (data: FlowchartData) => void | Promise<void>;
  }

  let { initialData, openWith, onSave }: Props = $props();

  let dialog: FlowchartEditDialog | undefined = $state();
  let open = $state(false);
</script>

<button type="button" onclick={() => dialog?.open(openWith)}>Open the diagram</button>
<p data-testid="open-state">{open ? 'open' : 'closed'}</p>

<FlowchartEditDialog bind:this={dialog} bind:open {initialData} {onSave} />
