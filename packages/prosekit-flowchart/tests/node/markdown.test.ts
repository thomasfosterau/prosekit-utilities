/**
 * Behavioural tests for the flowchart Markdown placeholder
 * (`../../src/lib/node/markdown.ts`).
 *
 * Pins the default label (Website's own `_[flowchart diagram]_`) and that
 * the factory produces a serialiser overridable with a custom label,
 * ignoring the node passed to it either way.
 *
 * Ported from the `it("labels a flowchart placeholder rather than dropping
 * it", ...)` case of Website's `tests/markdown.test.ts`, plus a case for the
 * label override this package's factory shape adds.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import { flowchartMarkdown } from '../../src/lib/node/markdown.ts';
import type { MarkdownContext } from '@thomasfosterau/prosekit-utilities';

const context: MarkdownContext = {
  serialiseInline: () => '',
  serialiseBlocks: () => '',
  escape: (text) => text,
};

describe('flowchartMarkdown', () => {
  it('renders the default placeholder', () => {
    const serialise = flowchartMarkdown();
    expect(serialise({ type: 'flowchart', attrs: { data: {} } }, context)).toBe(
      '_[flowchart diagram]_',
    );
  });

  it('renders a caller-supplied label instead', () => {
    const serialise = flowchartMarkdown('_[diagram omitted]_');
    expect(serialise({ type: 'flowchart', attrs: { data: {} } }, context)).toBe(
      '_[diagram omitted]_',
    );
  });

  it('ignores the node content either way', () => {
    const serialise = flowchartMarkdown();
    const withNodes = {
      type: 'flowchart',
      attrs: { data: { nodes: [{ id: 'a' }], edges: [] } },
    };
    expect(serialise(withNodes, context)).toBe('_[flowchart diagram]_');
  });
});
