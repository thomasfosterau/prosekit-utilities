import type { Meta, StoryObj } from '@storybook/sveltekit';
import FlowchartEditDialog from '../lib/FlowchartEditDialog.svelte';

/**
 * The modal that hosts the WYSIWYG canvas, on bits-ui's `Dialog`.
 *
 * What is reviewable here (the a11y panel included): the dialog is named by
 * `titleLabel` and described by `helpText`, focus moves inside and is trapped,
 * and Escape dismisses — all of it bits-ui's, none of it re-implemented. The
 * one behaviour that is this component's own is the pending guard: while
 * `onSave` is in flight both buttons are disabled and Escape is refused, so a
 * save is never abandoned halfway. The "Saving forever" story is that state,
 * held open.
 *
 * The canvas itself arrives through a dynamic `import()` on first open, which
 * is why the box is briefly empty.
 */
const meta = {
  title: 'Flowchart/FlowchartEditDialog',
  component: FlowchartEditDialog,
  tags: ['autodocs'],
} satisfies Meta<typeof FlowchartEditDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const diagram = {
  nodes: [
    { id: 'a', position: { x: 80, y: 40 }, data: { label: 'Draft' } },
    { id: 'b', position: { x: 80, y: 180 }, data: { label: 'In review' } },
  ],
  edges: [{ id: 'a-b', source: 'a', target: 'b' }],
};

/** Open on an existing diagram. Save logs the snapshot and closes. */
export const Open: Story = {
  args: {
    open: true,
    initialData: diagram,
    onSave: () => {},
  },
};

/** A save that never settles: both buttons disabled, Escape refused. */
export const SavingForever: Story = {
  args: {
    open: true,
    initialData: diagram,
    onSave: () => new Promise<void>(() => {}),
  },
};

/** A rejecting save keeps the dialog open and explains itself in a `role="alert"`. */
export const SaveFails: Story = {
  args: {
    open: true,
    initialData: diagram,
    onSave: () => Promise.reject(new Error('The diagram could not be stored.')),
  },
};

/** Every string is a prop; there is no message catalogue. */
export const CopyIsAProp: Story = {
  args: {
    open: true,
    initialData: diagram,
    onSave: () => {},
    titleLabel: 'Modifier le diagramme',
    addNodeLabel: 'Ajouter un nœud',
    helpText: "Glissez du bas d'un nœud vers le haut d'un autre pour les relier.",
    saveLabel: 'Enregistrer',
    savingLabel: 'Enregistrement…',
    cancelLabel: 'Annuler',
    closeLabel: 'Fermer',
    newNodeLabel: 'Étape',
    // Forwarded to the canvas: the nodes inside the dialog are its surface too.
    nodeLabelLabel: 'Étiquette du nœud',
    untitledLabel: 'Sans titre',
  },
};
