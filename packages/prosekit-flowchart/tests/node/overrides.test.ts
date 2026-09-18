/**
 * Behavioural tests for the flowchart attribute-overlay entry
 * (`../../src/lib/node/overrides.ts`).
 *
 * Pins that `flowchart.data` is present, schema-typed as
 * {@link FlowchartData}, and wrapped in `required(...)` — the entry a
 * missing overlay, or one that forgot the wrapper, would silently let a
 * machine-authored flowchart with no `data` decode.
 *
 * Ported from the intent (not the full document-decode assertion, which is
 * `./prosekit`'s `defineDocumentSchema` family's to own) of the
 * `it("rejects a flowchart missing attrs.data, ...")` case in Website's
 * `tests/document-models.test.ts`.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import { isRequiredAttribute } from '@thomasfosterau/prosekit-utilities/derive';
import { FLOWCHART_ATTRIBUTE_OVERRIDES } from '../../src/lib/node/overrides.ts';
import { FlowchartData } from '../../src/lib/node/schema.ts';

describe('FLOWCHART_ATTRIBUTE_OVERRIDES', () => {
  it('carries exactly one entry: flowchart.data', () => {
    expect(Object.keys(FLOWCHART_ATTRIBUTE_OVERRIDES)).toEqual(['flowchart']);
    expect(Object.keys(FLOWCHART_ATTRIBUTE_OVERRIDES.flowchart!)).toEqual(['data']);
  });

  it('wraps the schema in required(...)', () => {
    expect(isRequiredAttribute(FLOWCHART_ATTRIBUTE_OVERRIDES.flowchart!.data)).toBe(true);
  });

  it('wraps exactly the FlowchartData schema', () => {
    const wrapped = FLOWCHART_ATTRIBUTE_OVERRIDES.flowchart!.data;
    if (!isRequiredAttribute(wrapped)) throw new Error('expected a RequiredAttribute');
    expect(wrapped.schema).toBe(FlowchartData);
  });
});
