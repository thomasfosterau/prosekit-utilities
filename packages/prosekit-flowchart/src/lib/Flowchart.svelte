<!--
  Flowchart — the `@xyflow/svelte` canvas that renders a `FlowchartData`
  payload.

  This is the ONE module in the package that imports `@xyflow/svelte`, and with
  it the package's only side-effecting import,
  `@xyflow/svelte/dist/style.css`. Everything else — the node spec, the
  payload schema, the server-renderable SVG the node view previews with —
  lives under `./node`, which imports neither Svelte nor xyflow. That split is
  what keeps the canvas bundle off every page that merely displays a diagram.

  Two modes:
  - `interactive={false}` (the default): a read-only render. No panning, no
    connecting, nodes immovable, no `Controls`.
  - `interactive={true}`: the full WYSIWYG canvas. `addNode(label)` appends a
    node; drag from a node's bottom handle to another's top to connect;
    double-click a node to edit its label; Delete removes the selection.

  ## Why there is no `onchange`

  The parent reads the current diagram with `getSnapshot()` rather than
  receiving reactive change events. That keeps the data flow strictly one-way
  — payload in as a prop, snapshot pulled out on save — and avoids a reactive
  bounce between the parent's draft state and xyflow's per-frame internal
  mutations. `resetTo(payload)` is the other direction, and the dialog calls it
  once the canvas has a real layout box for `fitView` to work against.

  Svelte Flow depends on DOM measurement, so the canvas is gated on a `window`
  check; a server render emits the `summaryLabel` paragraph instead, which
  hydration replaces.
-->
<script lang="ts">
  import {
    Background,
    Controls,
    SvelteFlow,
    type Connection,
    type Edge,
    type Node,
    type NodeTypes,
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { untrack } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import EditableNode, { type EditableNodeData } from './EditableNode.svelte';
  import type { FlowchartData } from './node/schema.ts';

  // A library package cannot import SvelteKit's `$app/environment`; this is its
  // portable equivalent (Node SSR and Cloudflare Workers never define `window`,
  // browsers always do).
  const browser = typeof window !== 'undefined';

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
    /** Persisted flowchart payload — used to initialise the canvas. */
    data: FlowchartData;
    /** Enable the add / move / connect / edit / delete affordances. */
    interactive?: boolean | undefined;
    /** Classes on the canvas container; merged last, so they win. */
    class?: string | undefined;
    /** The server-render fallback sentence, given the node and edge counts. */
    summaryLabel?: ((nodes: number, edges: number) => string) | undefined;
    /** Default label for a node added by {@link addNode}. */
    newNodeLabel?: string | undefined;
    /** Accessible name of the label edit field inside a node. */
    nodeLabelLabel?: string | undefined;
    /** Shown, and committed, when a node's label is blank. */
    untitledLabel?: string | undefined;
  }

  let {
    data,
    interactive = false,
    class: className = 'h-96',
    summaryLabel = (nodeCount: number, edgeCount: number) =>
      `Flowchart with ${nodeCount} node(s) and ${edgeCount} edge(s)`,
    newNodeLabel = 'New',
    nodeLabelLabel = 'Node label',
    untitledLabel = 'Untitled',
    ...rest
  }: Props = $props();

  /**
   * The copy `EditableNode` reads out of each node's `data`. Svelte Flow
   * instantiates that component itself, so this is the only channel its two
   * strings can travel down — see its header comment.
   */
  const labels = $derived({ nodeLabelLabel, untitledLabel });

  function nodeData(label: string): EditableNodeData {
    return { label, readOnly: !interactive, labels };
  }

  function toFlowNodes(payload: FlowchartData): Node[] {
    return payload.nodes.map((node) => ({
      id: node.id,
      type: 'editable',
      position: { x: node.position.x, y: node.position.y },
      data: nodeData(node.data.label),
    }));
  }

  function toFlowEdges(payload: FlowchartData): Edge[] {
    return payload.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    }));
  }

  // Local state is seeded from the `data` prop ONCE, inside `untrack` so it
  // deliberately does not subscribe to later changes — `resetTo()` is how a
  // parent replaces the diagram. Subscribing here would loop xyflow's
  // per-frame mutations against the parent's draft.
  let nodes = $state<Node[]>(untrack(() => toFlowNodes(data)));
  let edges = $state<Edge[]>(untrack(() => toFlowEdges(data)));

  /** Replace the canvas state with the given payload. */
  export function resetTo(payload: FlowchartData): void {
    nodes = toFlowNodes(payload);
    edges = toFlowEdges(payload);
  }

  /** Strip xyflow's internal state and return the persisted shape. */
  export function getSnapshot(): FlowchartData {
    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        position: { x: node.position.x, y: node.position.y },
        data: { label: (node.data as { label?: string }).label ?? '' },
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
    };
  }

  /** Append a node with the given label at a staggered default position. */
  export function addNode(label: string = newNodeLabel): void {
    // Stagger new nodes diagonally so repeated "Add node" presses do not pile
    // them on top of each other.
    const offset = nodes.length * 30;
    nodes = [
      ...nodes,
      {
        id: newId('n'),
        type: 'editable',
        position: { x: 60 + offset, y: 60 + offset },
        data: nodeData(label),
      },
    ];
  }

  const nodeTypes: NodeTypes = { editable: EditableNode };

  function newId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function handleConnect(connection: Connection): void {
    if (!interactive) return;
    edges = [
      ...edges,
      { id: newId('e'), source: connection.source, target: connection.target },
    ];
  }
</script>

<div {...rest} class={['flowchart-canvas', className]}>
  {#if browser}
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      nodesDraggable={interactive}
      nodesConnectable={interactive}
      elementsSelectable={interactive}
      edgesFocusable={interactive}
      panOnDrag={interactive}
      zoomOnScroll={interactive}
      zoomOnPinch={interactive}
      zoomOnDoubleClick={false}
      panOnScroll={false}
      onconnect={handleConnect}
      fitView
    >
      <Background />
      {#if interactive}
        <Controls />
      {/if}
    </SvelteFlow>
  {:else}
    <p class="text-base-content/60 p-4 text-sm">
      {summaryLabel(data.nodes.length, data.edges.length)}
    </p>
  {/if}
</div>

<style>
  .flowchart-canvas {
    width: 100%;
    position: relative;
  }
</style>
