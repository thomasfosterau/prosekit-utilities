import { Schema, type Node as ProseMirrorNode } from '@prosekit/pm/model';
import type { Meta, StoryObj } from '@storybook/sveltekit';
import { writable } from 'svelte/store';
import FlowchartNodeView from '../lib/FlowchartNodeView.svelte';
import type { FlowchartData } from '../lib/node/schema.ts';

/**
 * What ProseKit mounts in place of a `flowchart` node in a document.
 *
 * The preview is the SAME server-renderable SVG a reader page gets
 * (`generateFlowchartSvg`, from the `./node` entry), so the editor and the
 * published article cannot drift — and so the canvas bundle only arrives when
 * the author presses Edit.
 *
 * The two stores and `setAttrs` here stand in for ProseKit's node-view
 * context, which is the one place in this workspace where a Svelte store is
 * part of the contract.
 */
const meta = {
  title: 'Flowchart/FlowchartNodeView',
  component: FlowchartNodeView,
  tags: ['autodocs'],
} satisfies Meta<typeof FlowchartNodeView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A minimal ProseMirror schema with a `flowchart` node. The view reads only
 * its `attrs`, so the story needs no editor or real node spec.
 */
const storySchema = new Schema({
  nodes: {
    doc: { content: 'flowchart*' },
    flowchart: { attrs: { data: {} } },
    text: {},
  },
});

/** A real `flowchart` node carrying `data`. */
const nodeWith = (data: FlowchartData): ProseMirrorNode => storySchema.node('flowchart', { data });

const diagram: FlowchartData = {
  nodes: [
    { id: 'a', position: { x: 0, y: 0 }, data: { label: 'Draft' } },
    { id: 'b', position: { x: 0, y: 120 }, data: { label: 'In review' } },
  ],
  edges: [{ id: 'a-b', source: 'a', target: 'b' }],
};

/** A node in a document. The Edit button appears on hover and on focus. */
export const Preview: Story = {
  args: {
    node: writable(nodeWith(diagram)),
    selected: writable(false),
    setAttrs: () => {},
  },
};

/** Selected by ProseMirror: the border changes and the Edit button stays visible. */
export const Selected: Story = {
  args: {
    node: writable(nodeWith(diagram)),
    selected: writable(true),
    setAttrs: () => {},
  },
};

/** A block whose payload is empty still renders a labelled placeholder. */
export const EmptyDiagram: Story = {
  args: {
    node: writable(nodeWith({ nodes: [], edges: [] })),
    selected: writable(false),
    setAttrs: () => {},
  },
};
