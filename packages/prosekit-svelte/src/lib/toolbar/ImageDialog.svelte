<!-- @component The image prompt as a bits-ui modal, asking only for the source URL the stock `image` node can hold. -->

<!--
  ImageDialog — the image prompt, as a modal. `LinkDialog`'s reasoning,
  applied to the other prompt.

  One field, deliberately. The applications this package was extracted from
  asked four questions — source, alt text, title, caption — and passed all
  four as node attributes; ProseKit's stock `image` node declares `src`,
  `width` and `height`, so ProseMirror's `computeAttrs` dropped the other
  three on the way in. Three of those four prompts collected text that went
  nowhere. Only the one the schema can hold is asked for here; an
  application whose image node declares more passes its own toolbar item.

  ARIA contract: bits-ui's, as `LinkDialog`.
-->
<script lang="ts">
  import { isSafeHref } from '@thomasfosterau/prosekit-utilities';
  import { Dialog } from 'bits-ui';
  import type { HTMLAttributes } from 'svelte/elements';
  import { getEditorMessages } from '../messages.svelte.ts';

  // The native attributes (`id`, `data-*`, `aria-*`, …) go on the dialog
  // element itself, bits-ui's `Dialog.Content` (`role="dialog"`), which is
  // also where `class` lands. Spread first, and the modal contract still
  // wins: bits-ui merges its own `role`, `aria-modal`, `aria-labelledby`
  // (the `Dialog.Title`) and `aria-describedby` after the caller's props,
  // keeping a caller value only where its own is `undefined`.
  // `id` is redeclared without `null`, which bits-ui's primitives do not
  // accept, and passed only when defined. None of `Dialog.Content`'s
  // behaviour props (`onEscapeKeydown`, `onInteractOutside`,
  // `onOpenAutoFocus`, `trapFocus`, `forceMount`, …) shares a name with an
  // HTML attribute, so nothing else needs leaving out; they stay off this
  // API because the component owns the dialog's behaviour.
  // With no `Dialog.Description`, a caller's `aria-describedby` is kept and
  // describes the dialog.
  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class' | 'id'> {
    /** The dialog element's `id`. */
    id?: string | undefined;
    /** Whether the dialog is shown. Bindable. */
    open?: boolean | undefined;
    /** The URL the form opens with. */
    src?: string | undefined;
    /** Called with the accepted attributes when the form is submitted. */
    onSubmit: (attrs: { src: string }) => void;
    /** The dialog's heading, and its accessible name. */
    titleLabel?: string | undefined;
    /** Label of the source field. */
    srcLabel?: string | undefined;
    /** The submit button. */
    submitLabel?: string | undefined;
    /** The cancel button. */
    cancelLabel?: string | undefined;
    /** Accessible name of the corner close button. */
    closeLabel?: string | undefined;
    /** Announced when the source is rejected. */
    invalidSrcMessage?: string | undefined;
    /** Extra classes on the dialog box. */
    class?: string | undefined;
  }

  const messages = getEditorMessages();

  let {
    open = $bindable(false),
    src = '',
    onSubmit,
    titleLabel = messages.imageDialogTitle,
    srcLabel = messages.imageSrcLabel,
    submitLabel = messages.imageSubmitLabel,
    cancelLabel = messages.imageCancelLabel,
    closeLabel = messages.imageCloseLabel,
    invalidSrcMessage = messages.imageInvalidSrcMessage,
    class: className,
    id,
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const srcId = `${uid}-src`;
  const errorId = `${uid}-error`;

  let srcValue = $state('');
  let invalid = $state(false);

  $effect(() => {
    if (!open) return;
    srcValue = src;
    invalid = false;
  });

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    const candidate = srcValue.trim();
    if (!isSafeHref(candidate)) {
      invalid = true;
      return;
    }
    onSubmit({ src: candidate });
    open = false;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="bg-base-300/60 fixed inset-0 z-40" />
    <Dialog.Content
      {...rest}
      {...(id === undefined ? {} : { id })}
      class={[
        'modal-box fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
        className,
      ]}
    >
      <div class="flex items-start justify-between gap-4">
        <Dialog.Title class="text-lg font-semibold">{titleLabel}</Dialog.Title>
        <Dialog.Close class="btn btn-sm btn-ghost -mr-1 -mt-1">{closeLabel}</Dialog.Close>
      </div>

      <form class="mt-4 flex flex-col gap-3" onsubmit={submit}>
        <label class="flex flex-col gap-1 text-sm" for={srcId}>
          {srcLabel}
          <input
            id={srcId}
            class="input input-bordered w-full"
            type="text"
            bind:value={srcValue}
            aria-invalid={invalid ? 'true' : undefined}
            aria-describedby={invalid ? errorId : undefined}
          />
        </label>

        {#if invalid}
          <p id={errorId} role="alert" class="text-error text-sm">{invalidSrcMessage}</p>
        {/if}

        <div class="modal-action">
          <button type="button" class="btn btn-sm btn-ghost" onclick={() => (open = false)}>
            {cancelLabel}
          </button>
          <button type="submit" class="btn btn-sm btn-primary">{submitLabel}</button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
