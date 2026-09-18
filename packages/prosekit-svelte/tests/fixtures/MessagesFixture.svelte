<!-- A render site that wires the messages context, the way an application
     does: `setEditorMessages` during initialisation, then the editor below
     it. `setContext` is only legal inside a component's initialisation, so a
     `.ts` test cannot call it directly. -->
<script lang="ts">
  import { defineBlockDocumentExtension } from '@thomasfosterau/prosekit-utilities/prosekit';
  import { untrack } from 'svelte';
  import Editor from '../../src/lib/editor/Editor.svelte';
  import { setEditorMessages, type EditorMessages } from '../../src/lib/messages.svelte.ts';
  import BlockToolbar from '../../src/lib/toolbar/BlockToolbar.svelte';

  interface Props {
    overrides?: Partial<EditorMessages> | undefined;
  }

  let { overrides }: Props = $props();

  const initial = untrack(() => overrides);
  if (initial !== undefined) setEditorMessages(initial);

  const extension = defineBlockDocumentExtension();
</script>

<Editor {extension}>
  <BlockToolbar />
</Editor>
