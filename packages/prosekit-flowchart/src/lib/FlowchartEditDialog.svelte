<!-- @component The modal that hosts the editable `Flowchart` canvas, loaded on open; Save hands the diagram to `onSave`. -->

<!--
  FlowchartEditDialog — the modal that hosts the full WYSIWYG canvas.

  Opens either from the bindable `open` prop or from the imperative
  `open(data)` instance method the node view uses. On Save it pulls the current
  diagram out of `Flowchart` with `getSnapshot()` and hands it to `onSave`,
  which may be async; Cancel discards.

  ## bits-ui, not a native `<dialog>`

  The app this is ported from used a native `<dialog class="modal">`. bits-ui's
  `Dialog` is used instead because it owns the whole modal contract — the focus
  trap, the initial focus move, `aria-modal`, the `aria-labelledby` /
  `aria-describedby` wiring to `Dialog.Title` and `Dialog.Description`, the
  scroll lock and the focus return — and because a native `<dialog>`'s built-in
  Escape handling cannot be gated: it closes the dialog out from under an
  in-flight save. Here Escape goes through `onOpenChange`, which refuses to
  close while `pending`, so a save in flight is never abandoned halfway.

  ## The canvas is loaded on open, not on import

  `Flowchart.svelte` is reached through a dynamic `import()` in the effect
  below, and the type-only import is what keeps that true. It is the package's
  heaviest module — `@xyflow/svelte` plus its stylesheet — and the node view
  that mounts this dialog renders every flowchart in a document. A static
  import here would put the whole canvas engine in the chunk of any page with
  an editor on it, which is precisely what the SVG preview exists to avoid.

  Affordances inside the canvas: the "Add node" button appends a node; drag
  from a node's bottom handle to another's top to connect; double-click a node
  to edit its label; select a node or edge and press Delete to remove it.
-->
<script lang="ts">
  import { Dialog } from 'bits-ui';
  import type Flowchart from './Flowchart.svelte';
  import { EMPTY_FLOWCHART } from './node/data.ts';
  import type { FlowchartData } from './node/schema.ts';

  interface Props {
    /** Whether the dialog is shown. Bindable. */
    open?: boolean | undefined;
    /** The payload the canvas opens with, when `open(data)` is not given one. */
    initialData?: FlowchartData | undefined;
    /** Called with the snapshot on Save; may be async, and may reject. */
    onSave: (data: FlowchartData) => void | Promise<void>;
    /** Heading — the dialog's accessible name. */
    titleLabel?: string | undefined;
    /** The button that appends a node to the canvas. */
    addNodeLabel?: string | undefined;
    /** The supporting sentence under the heading — the accessible description. */
    helpText?: string | undefined;
    /** The confirm button, at rest. */
    saveLabel?: string | undefined;
    /** The confirm button, while `onSave` is in flight. */
    savingLabel?: string | undefined;
    /** The discard button. */
    cancelLabel?: string | undefined;
    /** Accessible name of the corner close button. */
    closeLabel?: string | undefined;
    /** Shown when `onSave` rejects with something that is not an `Error`. */
    failureMessage?: string | undefined;
    /** Label given to a node added by the "Add node" button. */
    newNodeLabel?: string | undefined;
    /** Accessible name of a node's label field, forwarded to the canvas. */
    nodeLabelLabel?: string | undefined;
    /** Shown, and committed, when a node's label is blank; forwarded to the canvas. */
    untitledLabel?: string | undefined;
    /** Extra classes on the `modal-box`; merged last, so they win. */
    class?: string | undefined;
  }

  // The `open` PROP is bound to `isOpen` because this component also exports an
  // `open(data)` METHOD (the node view's entry point) and the two cannot share
  // a name in one scope.
  let {
    open: isOpen = $bindable(false),
    initialData = EMPTY_FLOWCHART,
    onSave,
    titleLabel = 'Edit flowchart',
    addNodeLabel = 'Add node',
    helpText = "Drag from a node's bottom to another's top to connect. Double-click a node to edit its label. Select and press Delete to remove.",
    saveLabel = 'Save',
    savingLabel = 'Saving…',
    cancelLabel = 'Cancel',
    closeLabel = 'Close',
    failureMessage = 'Failed to save diagram.',
    newNodeLabel = 'New',
    nodeLabelLabel = 'Node label',
    untitledLabel = 'Untitled',
    class: className,
  }: Props = $props();

  // A `bind:this` target, so the declared type must literally be `T |
  // undefined`: Svelte assigns the component instance itself into it, and
  // `undefined` before mount and after unmount.
  let flowchart: Flowchart | undefined = $state();
  /** The canvas component itself, once the dialog has been opened at least once. */
  let FlowchartCanvas: typeof Flowchart | undefined = $state();
  let pending = $state(false);
  let errorMessage = $state('');

  /**
   * The payload queued by `open(data)` for the canvas that does not exist yet.
   * Deliberately NOT `$state`: it is read and cleared inside the effect below,
   * and making it reactive would make that effect invalidate itself.
   */
  let queued: FlowchartData | undefined;

  /**
   * Open the dialog on the given payload (default: `initialData`).
   *
   * The imperative entry point, kept for the ProseKit node view, which has an
   * instance to reach through `bind:this` but no place to thread a bound prop.
   */
  export function open(data?: FlowchartData): void {
    errorMessage = '';
    queued = data ?? initialData;
    isOpen = true;
  }

  // Pull the canvas in the first time the dialog opens. Everything it drags
  // behind it — `@xyflow/svelte` and its stylesheet — stays out of the chunk
  // that merely renders the node view's SVG preview.
  $effect(() => {
    if (!isOpen || FlowchartCanvas !== undefined) return;
    void import('./Flowchart.svelte').then((module) => {
      FlowchartCanvas = module.default;
    });
  });

  // Seed the canvas only once the dialog's content has mounted: `fitView` needs
  // a real layout box, and bits-ui does not render `Dialog.Content` until the
  // dialog is open. The effect re-runs when `bind:this` fills `flowchart` in;
  // `queueMicrotask` then defers past the mount effect that measures it.
  $effect(() => {
    if (!isOpen) return;
    const canvas = flowchart;
    if (canvas === undefined) return;
    const payload = queued ?? initialData;
    queued = undefined;
    queueMicrotask(() => {
      canvas.resetTo(payload);
    });
  });

  /**
   * bits-ui's request to change the open state — Escape, an outside click, or
   * the close button. Refused while a save is in flight, so the dialog cannot
   * disappear while `onSave` is still running.
   */
  function handleOpenChange(next: boolean): void {
    if (!next && pending) return;
    if (!next) errorMessage = '';
    isOpen = next;
  }

  function close(): void {
    handleOpenChange(false);
  }

  async function save(): Promise<void> {
    const snapshot = flowchart?.getSnapshot();
    if (snapshot === undefined) return;
    pending = true;
    errorMessage = '';
    try {
      await onSave(snapshot);
      isOpen = false;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : failureMessage;
    } finally {
      pending = false;
    }
  }

  function addNode(): void {
    flowchart?.addNode(newNodeLabel);
  }
</script>

<Dialog.Root bind:open={() => isOpen, handleOpenChange}>
  <Dialog.Portal>
    <!-- daisyUI's `modal-backdrop` is a child of an open `.modal`; this is the
         same scrim as an element bits-ui can dismiss from. -->
    <Dialog.Overlay class="bg-base-300/60 fixed inset-0 z-40" />
    <Dialog.Content
      class={[
        'modal-box fixed top-1/2 left-1/2 z-50 max-h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2',
        className,
      ]}
    >
      <div class="flex items-center justify-between gap-3">
        <Dialog.Title class="text-lg font-bold">{titleLabel}</Dialog.Title>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-sm btn-primary" disabled={pending} onclick={addNode}>
            {addNodeLabel}
          </button>
          <Dialog.Close>
            {#snippet child({ props })}
              <button
                {...props}
                type="button"
                class="btn btn-sm btn-ghost btn-square"
                disabled={pending}
                aria-label={closeLabel}
              >
                <span aria-hidden="true">✕</span>
              </button>
            {/snippet}
          </Dialog.Close>
        </div>
      </div>
      <Dialog.Description class="text-base-content/70 mt-1 text-sm">
        {helpText}
      </Dialog.Description>
      <div class="border-base-300 mt-4 rounded border" style="height: 32rem;">
        {#if FlowchartCanvas}
          <!-- `nodeLabelLabel` and `untitledLabel` are forwarded rather than
               left to the canvas's own defaults: the nodes an author edits in
               here are the dialog's surface, and an application that
               translated the dialog would otherwise find English inside it. -->
          <FlowchartCanvas
            bind:this={flowchart}
            data={initialData}
            interactive
            class="h-full"
            {nodeLabelLabel}
            {untitledLabel}
          />
        {/if}
      </div>
      {#if errorMessage !== ''}
        <p class="text-error pt-3 text-sm" role="alert">{errorMessage}</p>
      {/if}
      <div class="modal-action">
        <button type="button" class="btn btn-ghost" disabled={pending} onclick={close}>
          {cancelLabel}
        </button>
        <button type="button" class="btn btn-primary" disabled={pending} onclick={save}>
          {pending ? savingLabel : saveLabel}
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
