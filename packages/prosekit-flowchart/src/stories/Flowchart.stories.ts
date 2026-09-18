import type { Meta, StoryObj } from '@storybook/sveltekit';
import Flowchart from '../lib/Flowchart.svelte';

/**
 * The `@xyflow/svelte` canvas. `interactive={false}` — the default — is the
 * read-only render a reader page would use if it did not have the cheaper
 * server-side SVG; `interactive` is the WYSIWYG surface the edit dialog hosts.
 *
 * `resetTo`, `getSnapshot` and `addNode` are instance methods, reached through
 * `bind:this` — there is nothing for a story to click, so what is reviewable
 * here is the rendering: node boxes, the curved edge with its arrow, the
 * dot-grid background, and the zoom controls that appear only when the canvas
 * can actually honour them.
 */
const meta = {
  title: 'Flowchart/Flowchart',
  component: Flowchart,
  tags: ['autodocs'],
} satisfies Meta<typeof Flowchart>;

export default meta;
type Story = StoryObj<typeof meta>;

const diagram = {
  nodes: [
    { id: 'a', position: { x: 80, y: 40 }, data: { label: 'Draft' } },
    { id: 'b', position: { x: 80, y: 180 }, data: { label: 'In review' } },
    { id: 'c', position: { x: 300, y: 180 }, data: { label: 'Published' } },
  ],
  edges: [
    { id: 'a-b', source: 'a', target: 'b' },
    { id: 'b-c', source: 'b', target: 'c' },
  ],
};

/** The default: no panning, no connecting, nodes immovable, no controls. */
export const ReadOnly: Story = {
  args: { data: diagram },
};

/** The editing surface. Double-click a node to rename it; drag a handle to connect. */
export const Interactive: Story = {
  args: { data: diagram, interactive: true },
};

/** An empty payload renders an empty canvas rather than nothing at all. */
export const Empty: Story = {
  args: { data: { nodes: [], edges: [] } },
};

/**
 * Every string is a prop — including the two the canvas passes down into each
 * node, which Svelte Flow instantiates itself and so cannot receive props of
 * its own.
 */
export const CopyIsAProp: Story = {
  args: {
    data: { nodes: [{ id: 'a', position: { x: 60, y: 40 }, data: { label: '' } }], edges: [] },
    interactive: true,
    newNodeLabel: 'Étape',
    nodeLabelLabel: 'Étiquette du nœud',
    untitledLabel: 'Sans titre',
  },
};
