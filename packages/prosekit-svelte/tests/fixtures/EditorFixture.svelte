<!-- `Editor` with its `content` binding rendered out, so a test can read the
     document back the way a consumer does rather than off the DOM. -->
<script lang="ts">
  import type { NodeJSON } from '@thomasfosterau/prosekit-utilities';
  import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import Editor from '../../src/lib/editor/Editor.svelte';

  interface Props {
    label?: string | undefined;
    defaultContent?: NodeJSON | undefined;
    class?: string | undefined;
  }

  let { label, defaultContent, class: className }: Props = $props();

  let content = $state<NodeJSON | undefined>(undefined);

  const extension = defineBlockDocumentExtension();
</script>

<Editor bind:content {extension} {label} {defaultContent} class={className} />

<pre data-testid="content">{content === undefined ? '' : JSON.stringify(content)}</pre>
