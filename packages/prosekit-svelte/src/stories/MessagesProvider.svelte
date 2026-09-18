<!-- A render site that wires the messages context, for the messages story.
     `setEditorMessages` is only legal during a component's initialisation,
     so a story cannot call it inline. -->
<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { setEditorMessages, type EditorMessages } from '../lib/messages.svelte.ts';

  interface Props {
    overrides: Partial<EditorMessages>;
    children: Snippet<[]>;
  }

  let { overrides, children }: Props = $props();

  // The context is set once, during initialisation; `untrack` says so.
  setEditorMessages(untrack(() => overrides));
</script>

{@render children()}
