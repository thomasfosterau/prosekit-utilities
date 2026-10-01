<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  // `Flowchart` imports Svelte Flow's stylesheet; these stories render a bare
  // `SvelteFlow`, so they must too, or they only look right when a Flowchart
  // story happened to load it first (prosekit-utilities#34).
  import '@xyflow/svelte/dist/style.css';
  import { SvelteFlow, type Edge, type Node, type NodeTypes } from '@xyflow/svelte';
  import EditableNode from '../lib/EditableNode.svelte';

  /**
   * The node type the canvas renders. Svelte Flow instantiates it from the
   * `nodeTypes` map, so it is never mounted directly and never receives props
   * of its own — which is why its two strings ride in the node's `data`, and
   * why every story here is a small `SvelteFlow` rather than a bare component.
   *
   * Double-click a node, or focus it and press Enter, to edit its label; Enter
   * or blur commits, Escape discards, a blank label commits as the untitled
   * fallback. A read-only node does none of that and is out of the tab order.
   */
  const { Story } = defineMeta({
    title: 'Flowchart/EditableNode',
    component: EditableNode,
    parameters: {
      docs: {
        description: {
          component:
            'The inline-editable Svelte Flow node. Double-click (or Enter while focused) opens the label field; Enter commits, Escape discards, and a blank label commits as `untitledLabel`. Both strings arrive through the node’s `data`, because Svelte Flow constructs this component itself.',
        },
      },
    },
  });

  const nodeTypes: NodeTypes = { editable: EditableNode };
  const noEdges: Edge[] = [];
</script>

<script lang="ts">
  let editable = $state<Node[]>([
    { id: 'a', type: 'editable', position: { x: 40, y: 30 }, data: { label: 'Draft' } },
    { id: 'b', type: 'editable', position: { x: 200, y: 120 }, data: { label: '' } },
  ]);

  let readOnly = $state<Node[]>([
    { id: 'a', type: 'editable', position: { x: 40, y: 30 }, data: { label: 'Draft', readOnly: true } },
  ]);

  let translated = $state<Node[]>([
    {
      id: 'a',
      type: 'editable',
      position: { x: 40, y: 30 },
      data: {
        label: '',
        labels: { nodeLabelLabel: 'Étiquette du nœud', untitledLabel: 'Sans titre' },
      },
    },
  ]);
</script>

<Story name="Editable">
  <div style="height: 260px;">
    <SvelteFlow bind:nodes={editable} edges={noEdges} {nodeTypes} fitView />
  </div>
</Story>

<Story name="Read only">
  <div style="height: 260px;">
    <SvelteFlow
      bind:nodes={readOnly}
      edges={noEdges}
      {nodeTypes}
      nodesDraggable={false}
      elementsSelectable={false}
      fitView
    />
  </div>
</Story>

<Story name="Copy is a prop">
  <div style="height: 260px;">
    <SvelteFlow bind:nodes={translated} edges={noEdges} {nodeTypes} fitView />
  </div>
</Story>
