<!--
  EditableNode — the Svelte Flow node type this package's canvas renders, with
  an inline-editable label.

  Double-click, or Enter while the node has focus, switches to edit mode; Enter
  or blur commits the new label through `useSvelteFlow().updateNodeData(id, {
  label })`; Escape restores the label the node had. In read-only mode every
  edit handler is a no-op and the label renders as static text.

  ## Why its strings arrive through `data`

  Every other component in this workspace takes its user-facing copy as props
  with English defaults. This one cannot: Svelte Flow instantiates a node
  component itself, from the `nodeTypes` map, and passes it exactly the
  `NodeProps` it constructs — a caller has no call site to pass a prop at. So
  the two strings ride in the node's own `data` (`data.labels`), which
  `Flowchart` fills from ITS props, and the defaults are applied here. The
  contract is the same (every string overridable, English default); only the
  channel differs.

  ## ARIA contract

  The node is `role="button"` — its whole purpose is "activate me to edit" —
  and is in the tab order only when it is editable (`tabindex=-1` when
  read-only, so a reader tabbing through a published diagram is not stopped at
  every box). The edit field is named by `nodeLabelLabel`, because a bare
  `<input>` inside a node would otherwise be announced as nothing at all.
-->
<script module lang="ts">
  /** Overridable copy for {@link EditableNode}, carried in the node's `data`. */
  export interface EditableNodeLabels {
    /** Accessible name of the label edit field. Default: `'Node label'`. */
    readonly nodeLabelLabel?: string | undefined;
    /** Shown, and committed, when a label is blank. Default: `'Untitled'`. */
    readonly untitledLabel?: string | undefined;
  }

  /**
   * The `data` payload {@link EditableNode} expects — the persisted label plus
   * the two canvas-local fields `Flowchart` derives from its own props.
   *
   * A `type` rather than an `interface`, deliberately: Svelte Flow's `Node`
   * constrains its data to `Record<string, unknown>`, and only a type alias
   * gets the implicit index signature that satisfies it.
   */
  export type EditableNodeData = {
    /** The node's label, as persisted in the flowchart payload. */
    label: string;
    /** Set by `Flowchart` from its `interactive` prop; suppresses every edit affordance. */
    readOnly?: boolean | undefined;
    /** Copy overrides, passed down from `Flowchart`'s props. */
    labels?: EditableNodeLabels | undefined;
  };
</script>

<script lang="ts">
  import { Handle, Position, useSvelteFlow, type NodeProps } from '@xyflow/svelte';

  /**
   * Svelte Flow's own node props, narrowed to the `data` shape this node type
   * reads. `id`, `selected` and `data` are the only three it uses.
   */
  type Props = NodeProps & { data: EditableNodeData };

  let { id, data, selected }: Props = $props();

  const flow = useSvelteFlow();

  const nodeLabelLabel = $derived(data.labels?.nodeLabelLabel ?? 'Node label');
  const untitledLabel = $derived(data.labels?.untitledLabel ?? 'Untitled');

  let editing = $state(false);
  // `draft` only matters while `editing` is true; `startEdit` seeds it from the
  // current `data.label` at that moment.
  let draft = $state('');
  // A `bind:this` target, so the declared type must literally be `T |
  // undefined`: Svelte's compiler assigns the element itself into the variable,
  // and `undefined` before mount and after unmount.
  let inputRef: HTMLInputElement | undefined = $state();

  function startEdit(): void {
    if (data.readOnly === true) return;
    draft = data.label;
    editing = true;
    queueMicrotask(() => inputRef?.focus());
  }

  function commit(): void {
    const trimmed = draft.trim() || untitledLabel;
    flow.updateNodeData(id, { label: trimmed });
    editing = false;
  }

  function cancel(): void {
    draft = data.label;
    editing = false;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    event.preventDefault();
    // `stopPropagation` is load-bearing, not tidiness. Both handlers close edit
    // mode synchronously, so without it the same Enter keystroke bubbles to the
    // node wrapper below, finds `editing` already false, and immediately
    // reopens the field the user just committed. The browser suite catches it;
    // no type would.
    event.stopPropagation();
    if (event.key === 'Enter') commit();
    else cancel();
  }

  function handleNodeKeyDown(event: KeyboardEvent): void {
    if (data.readOnly !== true && event.key === 'Enter' && !editing) {
      event.preventDefault();
      startEdit();
    }
  }
</script>

<div
  class="flowchart-node bg-base-100 border-base-300 min-w-32 rounded border px-3 py-2 text-sm shadow-sm"
  class:border-primary={selected}
  class:cursor-text={data.readOnly !== true}
  ondblclick={startEdit}
  onkeydown={handleNodeKeyDown}
  role="button"
  tabindex={data.readOnly === true ? -1 : 0}
>
  <Handle type="target" position={Position.Top} isConnectable={data.readOnly !== true} />
  {#if editing}
    <input
      bind:this={inputRef}
      bind:value={draft}
      onkeydown={handleKeyDown}
      onblur={commit}
      class="input input-xs w-full"
      aria-label={nodeLabelLabel}
    />
  {:else}
    <span>{data.label || untitledLabel}</span>
  {/if}
  <Handle type="source" position={Position.Bottom} isConnectable={data.readOnly !== true} />
</div>

<style>
  .flowchart-node {
    box-sizing: border-box;
  }
</style>
