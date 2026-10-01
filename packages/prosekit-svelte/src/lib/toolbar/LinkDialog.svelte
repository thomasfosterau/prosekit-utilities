<!-- @component The link prompt as a bits-ui modal; the URL is checked with `isSafeHref` before it submits. -->

<!--
  LinkDialog — the link prompt, as a modal.

  It replaces a `window.prompt` chain. A prompt cannot be styled, cannot be
  validated before it closes, cannot be cancelled halfway through a
  two-question sequence without leaving the first answer applied, and is
  blocked outright in some embedding contexts. The dialog also gives the
  href somewhere to be checked: `isSafeHref` runs on submit and the failure
  is announced in a `role="alert"` rather than silently swallowed.

  ARIA contract: bits-ui's. `role="dialog"`, `aria-modal`, the
  `aria-labelledby` wiring to `Dialog.Title`, the focus trap, Escape, the
  scroll lock and the focus return to whatever opened it are all its. What is
  local: the fields, the validity check, the `aria-describedby` from the URL
  input to the alert, and a `<form>` — so Enter in either input submits,
  which is what anyone typing a URL expects.
-->
<script lang="ts">
  import { isSafeHref } from '@thomasfosterau/prosekit-utilities';
  import { Dialog } from 'bits-ui';
  import { getEditorMessages } from '../messages.svelte.ts';

  interface Props {
    /** Whether the dialog is shown. Bindable. */
    open?: boolean | undefined;
    /** The URL the form opens with — the selection's link, when there is one. */
    href?: string | undefined;
    /** The title the form opens with. */
    title?: string | undefined;
    /** Called with the accepted attributes when the form is submitted. */
    onSubmit: (attrs: { href: string; title: string | null }) => void;
    /** Called when the remove button is used. Omitted, no remove button. */
    onRemove?: (() => void) | undefined;
    /** The dialog's heading, and its accessible name. */
    titleLabel?: string | undefined;
    /** Label of the URL field. */
    hrefLabel?: string | undefined;
    /** Label of the optional title field. */
    linkTitleLabel?: string | undefined;
    /** The submit button. */
    submitLabel?: string | undefined;
    /** The remove button. */
    removeLabel?: string | undefined;
    /** The cancel button. */
    cancelLabel?: string | undefined;
    /** Accessible name of the corner close button. */
    closeLabel?: string | undefined;
    /** Announced when the URL is rejected. */
    invalidHrefMessage?: string | undefined;
    /** Extra classes on the dialog box. */
    class?: string | undefined;
  }

  const messages = getEditorMessages();

  let {
    open = $bindable(false),
    href = '',
    title = '',
    onSubmit,
    onRemove,
    titleLabel = messages.linkDialogTitle,
    hrefLabel = messages.linkHrefLabel,
    linkTitleLabel = messages.linkTitleLabel,
    submitLabel = messages.linkSubmitLabel,
    removeLabel = messages.linkRemoveLabel,
    cancelLabel = messages.linkCancelLabel,
    closeLabel = messages.linkCloseLabel,
    invalidHrefMessage = messages.linkInvalidHrefMessage,
    class: className,
  }: Props = $props();

  const uid = $props.id();
  const hrefId = `${uid}-href`;
  const titleId = `${uid}-title`;
  const errorId = `${uid}-error`;

  let hrefValue = $state('');
  let titleValue = $state('');
  let invalid = $state(false);

  // Seeded on every open, from whatever the caller last set: the toolbar
  // reads the selection's link mark before it opens the dialog, so the form
  // edits the existing link rather than starting blank over the top of one.
  $effect(() => {
    if (!open) return;
    hrefValue = href;
    titleValue = title;
    invalid = false;
  });

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    const candidate = hrefValue.trim();
    if (!isSafeHref(candidate)) {
      invalid = true;
      return;
    }
    const trimmedTitle = titleValue.trim();
    onSubmit({ href: candidate, title: trimmedTitle.length > 0 ? trimmedTitle : null });
    open = false;
  }

  function remove(): void {
    onRemove?.();
    open = false;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="bg-base-300/60 fixed inset-0 z-40" />
    <Dialog.Content
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
        <label class="flex flex-col gap-1 text-sm" for={hrefId}>
          {hrefLabel}
          <input
            id={hrefId}
            class="input input-bordered w-full"
            type="text"
            bind:value={hrefValue}
            aria-invalid={invalid ? 'true' : undefined}
            aria-describedby={invalid ? errorId : undefined}
          />
        </label>

        <label class="flex flex-col gap-1 text-sm" for={titleId}>
          {linkTitleLabel}
          <input id={titleId} class="input input-bordered w-full" type="text" bind:value={titleValue} />
        </label>

        {#if invalid}
          <p id={errorId} role="alert" class="text-error text-sm">{invalidHrefMessage}</p>
        {/if}

        <div class="modal-action">
          {#if onRemove}
            <button type="button" class="btn btn-sm btn-ghost" onclick={remove}>
              {removeLabel}
            </button>
          {/if}
          <button type="button" class="btn btn-sm btn-ghost" onclick={() => (open = false)}>
            {cancelLabel}
          </button>
          <button type="submit" class="btn btn-sm btn-primary">{submitLabel}</button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
