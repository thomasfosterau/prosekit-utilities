<!-- `BlockEditor` with a replacement toolbar snippet, which a `.ts` test has
     no template to declare. -->
<script lang="ts">
  import type { NodeJSON } from '@thomasfosterau/prosekit-utilities';
  import BlockEditor from '../../src/lib/editor/BlockEditor.svelte';

  interface Props {
    name?: string | undefined;
    documentType?: string | undefined;
    defaultContent?: NodeJSON | undefined;
  }

  let { name, documentType, defaultContent }: Props = $props();
</script>

<BlockEditor {name} {documentType} {defaultContent}>
  {#snippet toolbar()}
    <div data-testid="custom-toolbar">A toolbar of my own</div>
  {/snippet}
</BlockEditor>
