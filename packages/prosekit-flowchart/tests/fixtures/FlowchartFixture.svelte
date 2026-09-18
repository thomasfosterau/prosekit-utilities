<!--
  Plays the page that owns a `Flowchart`.

  `resetTo`, `getSnapshot` and `addNode` are instance methods reached through
  `bind:this`, and a `.ts` test has no template to bind in — so the fixture
  binds, exposes each method behind a named button, and publishes the snapshot
  as text a locator can read.

  The container is given a real pixel height: Svelte Flow measures its own box,
  and the library's own `h-96` default is a Tailwind class no stylesheet in this
  suite emits.
-->
<script lang="ts">
  import Flowchart from '../../src/lib/Flowchart.svelte';
  import type { FlowchartData } from '../../src/lib/node/schema.ts';

  interface Props {
    /** The payload the canvas is seeded from. */
    data: FlowchartData;
    /** Passed straight through. */
    interactive?: boolean | undefined;
    /** What the "Reset" button hands `resetTo`. */
    resetPayload?: FlowchartData | undefined;
    /** What the "Add node" button hands `addNode`; omitted means "use the default". */
    addLabel?: string | undefined;
    /** Passed straight through, so a test can override the canvas's copy. */
    newNodeLabel?: string | undefined;
  }

  let { data, interactive = false, resetPayload, addLabel, newNodeLabel }: Props = $props();

  let chart: Flowchart | undefined = $state();
  let snapshot = $state('');
</script>

<Flowchart
  bind:this={chart}
  {data}
  {interactive}
  {newNodeLabel}
  style="height: 320px"
  data-testid="canvas"
/>

<button type="button" onclick={() => chart?.addNode(addLabel)}>Add node</button>
<button
  type="button"
  onclick={() => {
    if (resetPayload !== undefined) chart?.resetTo(resetPayload);
  }}>Reset</button
>
<button
  type="button"
  onclick={() => {
    snapshot = JSON.stringify(chart?.getSnapshot());
  }}>Snapshot</button
>

<pre data-testid="snapshot">{snapshot}</pre>
