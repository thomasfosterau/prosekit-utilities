<!--
  The smallest Svelte Flow that can host an `EditableNode`.

  `EditableNode` is never rendered directly: Svelte Flow instantiates it from
  the `nodeTypes` map and supplies its `NodeProps`, and `useSvelteFlow()` — the
  hook `commit()` writes the label back through — only resolves inside a flow.
  So the fixture is the flow, and it publishes the node's current label as text
  so a test can assert what a commit actually wrote.
-->
<script lang="ts">
  import { SvelteFlow, type Edge, type Node, type NodeTypes } from '@xyflow/svelte';
  import { untrack } from 'svelte';
  import EditableNode, { type EditableNodeData } from '../../src/lib/EditableNode.svelte';

  interface Props {
    /** The node's starting label. */
    label?: string | undefined;
    /** Renders the node in its read-only mode. */
    readOnly?: boolean | undefined;
    /** Accessible name of the edit field; omitted means the component's default. */
    nodeLabelLabel?: string | undefined;
    /** Blank-label fallback; omitted means the component's default. */
    untitledLabel?: string | undefined;
  }

  let { label = 'Start', readOnly = false, nodeLabelLabel, untitledLabel }: Props = $props();

  const nodeTypes: NodeTypes = { editable: EditableNode };

  // Seeded from the props ONCE, inside `untrack` — the same one-way flow
  // `Flowchart` uses, and what keeps the compiler from warning that these
  // reads capture only the initial value (which is exactly the intent).
  let nodes = $state<Node[]>(
    untrack(() => {
      const data: EditableNodeData = {
        label,
        readOnly,
        labels: { nodeLabelLabel, untitledLabel },
      };
      return [{ id: 'n1', type: 'editable', position: { x: 40, y: 40 }, data }];
    }),
  );
  let edges = $state<Edge[]>([]);

  const currentLabel = $derived((nodes[0]?.data as { label?: string } | undefined)?.label ?? '');
</script>

<div style="height: 240px; width: 320px;">
  <SvelteFlow bind:nodes bind:edges {nodeTypes} fitView />
</div>

<p data-testid="label">{currentLabel}</p>
