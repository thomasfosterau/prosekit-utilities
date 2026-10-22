// @vitest-environment node
/**
 * The HTML renderer's SERVER branch: no global `document`, so
 * `createHtmlRenderer` falls through to linkedom.
 *
 * The package's vitest environment is node, and this file pins it explicitly
 * because the assertion below only means anything while `globalThis.document`
 * is absent. That branch is the one a server runtime takes, and it must be
 * linkedom rather than happy-dom: happy-dom pulls in `node:child_process` and
 * `node:vm`, which a worker runtime does not provide, so the import fails at
 * request time and takes down every page that renders prose.
 *
 * The expected HTML is an exact string, not a `toContain`: the serialiser's
 * escaping is half the SEC-XSS-001 defence in the source applications, and a
 * substring assertion would not notice it weakening.
 *
 * @module
 */

import { assert, describe, expect, it } from 'vite-plus/test';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { createHtmlRenderer, HtmlRenderError } from '../../src/prosekit/html.ts';
import { lazySchema } from '../../src/prosekit/lazy-schema.ts';
import {
  defineBlockDocumentExtension,
  defineInlineDocumentExtension,
} from '../../src/prosekit/presets.ts';

/** The rejection the failing `document` source below raises. */
class NoDom extends Schema.TaggedError<NoDom>()('NoDom', {}) {}

/**
 * Narrows linkedom's own `Document` class to the DOM's `Document`, which it
 * implements without being declared as.
 */
const isDocument = <A extends object>(value: A): value is A & Document => 'createElement' in value;

const blockRenderer = createHtmlRenderer({
  schema: lazySchema(() => defineBlockDocumentExtension()),
});
const inlineRenderer = createHtmlRenderer({
  schema: lazySchema(() => defineInlineDocumentExtension()),
});

describe('createHtmlRenderer (server path)', () => {
  it('renders a block document without a global DOM', async () => {
    expect(globalThis.document).toBeUndefined();

    const html = await blockRenderer.renderPromise({
      type: 'blockDocument',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Title & <co>' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'hello ' },
            {
              type: 'text',
              text: 'linked',
              marks: [{ type: 'link', attrs: { href: 'https://example.com/a' } }],
            },
          ],
        },
      ],
    });

    expect(html).toBe(
      '<div><h2>Title &amp; &lt;co&gt;</h2><p>hello <a href="https://example.com/a">linked</a></p></div>',
    );
  });

  it('strips an unsafe link href and drops an unsafe image on the server path too', async () => {
    const html = await blockRenderer.renderPromise({
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click me',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
            { type: 'image', attrs: { src: 'javascript:alert(1)' } },
          ],
        },
      ],
    });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img');
    expect(html).toContain('click me');
  });

  it('renders an inline document through its own schema', async () => {
    const html = await inlineRenderer.renderPromise({
      type: 'inlineDocument',
      content: [
        { type: 'text', text: 'Plain ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
      ],
    });
    expect(html).toContain('Plain ');
    expect(html).toContain('bold');
  });

  it('renders through the Effect channel as well', async () => {
    const html = await Effect.runPromise(
      blockRenderer.render({
        type: 'blockDocument',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'effectful' }] }],
      }),
    );
    expect(html).toBe('<div><p>effectful</p></div>');
  });

  it('resolves its Document once and reuses it', async () => {
    let resolutions = 0;
    const renderer = createHtmlRenderer({
      schema: lazySchema(() => defineBlockDocumentExtension()),
      document: async () => {
        resolutions += 1;
        const { parseHTML } = await import('linkedom');
        const { document } = parseHTML('<!doctype html><html><body></body></html>');
        assert(isDocument(document), 'linkedom yields a Document');
        return document;
      },
    });
    const doc = {
      type: 'blockDocument',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'once' }] }],
    };
    await renderer.renderPromise(doc);
    await renderer.renderPromise(doc);
    expect(resolutions).toBe(1);
  });

  it('fails with a dom-unavailable HtmlRenderError when the Document source rejects', async () => {
    const renderer = createHtmlRenderer({
      schema: lazySchema(() => defineBlockDocumentExtension()),
      document: () => Promise.reject(new NoDom()),
    });
    const doc = {
      type: 'blockDocument',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    };

    const error = await Effect.runPromise(Effect.flip(renderer.render(doc)));
    expect(error).toBeInstanceOf(HtmlRenderError);
    expect(error._tag).toBe('HtmlRenderError');
    expect(error.reason).toBe('dom-unavailable');
    expect(error.cause).toBeInstanceOf(Error);

    // The promise shape rejects with the same tagged error.
    await expect(renderer.renderPromise(doc)).rejects.toBeInstanceOf(HtmlRenderError);
  });

  it('fails with a serialise HtmlRenderError for a node the schema does not know', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        blockRenderer.render({
          type: 'blockDocument',
          content: [{ type: 'notARealNode' }],
        }),
      ),
    );
    expect(error.reason).toBe('serialise');
  });
});
