// @vitest-environment happy-dom
/**
 * The HTML renderer's BROWSER branch: a global `document` exists, so
 * `createHtmlRenderer`'s capability detection uses it and linkedom is never
 * imported.
 *
 * This is the branch an editor takes client-side. It also exercises the
 * `postProcess` hook, which needs a real `Document` to walk the rendered
 * string with — the seam a node that serialises to a placeholder element uses
 * to fill that placeholder in.
 *
 * @module
 */

import { describe, expect, it } from 'vite-plus/test';
import * as Array from 'effect/Array';
import * as Effect from 'effect/Effect';
import { createHtmlRenderer, HtmlRenderError, sanitiseDocument } from '../../src/prosekit/html.ts';
import { lazySchema } from '../../src/prosekit/lazy-schema.ts';
import { defineCitation } from '../../src/prosekit/marks.ts';
import { defineMention, defineSidenote } from '../../src/prosekit/nodes.ts';
import {
  defineBlockDocumentExtension,
  defineInlineDocumentExtension,
} from '../../src/prosekit/presets.ts';

const blockSchema = lazySchema(() =>
  defineBlockDocumentExtension(defineMention(), defineSidenote(), defineCitation()),
);

const blockRenderer = createHtmlRenderer({ schema: blockSchema });
const inlineRenderer = createHtmlRenderer({
  schema: lazySchema(() => defineInlineDocumentExtension()),
});

describe('createHtmlRenderer (browser path)', () => {
  it('renders against the global document with a heading and a paragraph', async () => {
    expect(globalThis.document).toBeDefined();
    const html = await blockRenderer.renderPromise({
      type: 'blockDocument',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
      ],
    });
    expect(html).toContain('<h2');
    expect(html).toContain('Title');
    expect(html).toContain('<p>body</p>');
  });

  it('strips an unsafe link href in the browser branch too', async () => {
    const html = await blockRenderer.renderPromise({
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    });
    expect(html).not.toContain('javascript:');
    expect(html).toContain('x');
  });

  it('keeps a safe link href', async () => {
    const html = await blockRenderer.renderPromise({
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'safe link',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
          ],
        },
      ],
    });
    expect(html).toContain('https://example.com');
  });

  it('drops an image node with an unsafe src in the browser branch too', async () => {
    const html = await blockRenderer.renderPromise({
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }],
        },
      ],
    });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img');
  });

  it('renders the opt-in nodes and marks through their own toDOM', async () => {
    const html = await blockRenderer.renderPromise({
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: 'u-1', label: 'rosa' } },
            { type: 'sidenote', content: [{ type: 'text', text: 'aside' }] },
            {
              type: 'text',
              text: 'cited',
              marks: [{ type: 'citation', attrs: { workId: 'w-1' } }],
            },
          ],
        },
      ],
    });
    expect(html).toContain('data-mention-id="u-1"');
    expect(html).toContain('@rosa');
    expect(html).toContain('data-sidenote');
    expect(html).toContain('aside');
    expect(html).toContain('data-work-id="w-1"');
  });

  it('escapes an untrusted mention label rather than emitting it as markup', async () => {
    // The label is display text a consumer does not control, and it reaches
    // the output twice: as the span's text child and as a data attribute. The
    // DOM serialiser escapes each for its own context — `<`/`>`/`&` in text,
    // `"`/`&` in an attribute value — so neither can break out. (`<` inside a
    // quoted attribute value is left as-is by the HTML serialisation spec and
    // is inert there; the quote is what would matter, and it is escaped.)
    const html = await blockRenderer.renderPromise({
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: 'u-1', label: '"><script>alert(1)</script>' } },
          ],
        },
      ],
    });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;');
    expect(html).not.toContain('data-mention-label=""><script>');
  });
});

describe('createHtmlRenderer (inline, browser path)', () => {
  it('renders inline marks against the global document', async () => {
    const html = await inlineRenderer.renderPromise({
      type: 'inlineDocument',
      content: [
        { type: 'text', text: 'Plain ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'emphasis', marks: [{ type: 'italic' }] },
        { type: 'text', text: 'console.log', marks: [{ type: 'code' }] },
      ],
    });
    expect(html).toContain('Plain ');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em');
    expect(html).toContain('<code');
  });
});

// ── The postProcess hook ──────────────────────────────────────────────

describe('postProcess', () => {
  it('rewrites a marker element using the same Document the render used', async () => {
    // The hook exists so a node whose `toDOM` emits a placeholder — a diagram
    // block carrying its payload in a data attribute, say — can replace that
    // placeholder's contents with a server-rendered snapshot. The marker here
    // is the mention span, which is enough to pin the contract: the hook
    // receives the serialised string and a live `Document`, and what it
    // returns is what the renderer returns.
    const renderer = createHtmlRenderer({
      schema: blockSchema,
      postProcess: (html, host) => {
        if (!html.includes('data-mention-id')) return html;
        const container = host.createElement('div');
        container.innerHTML = html;
        for (const marker of Array.fromIterable(container.querySelectorAll('[data-mention-id]'))) {
          marker.textContent = `resolved:${marker.getAttribute('data-mention-id') ?? ''}`;
        }
        return container.innerHTML;
      },
    });

    const html = await renderer.renderPromise({
      type: 'blockDocument',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'mention', attrs: { id: 'u-7', label: 'rosa' } }],
        },
      ],
    });
    expect(html).toContain('resolved:u-7');
    expect(html).not.toContain('@rosa');
    // The data attribute survives, so the document still round-trips.
    expect(html).toContain('data-mention-id="u-7"');
  });

  it('is not called at all when it is not configured', async () => {
    const html = await blockRenderer.renderPromise({
      type: 'blockDocument',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'plain' }] }],
    });
    expect(html).toBe('<div><p>plain</p></div>');
  });

  it('a throwing hook surfaces as a serialise HtmlRenderError', async () => {
    const renderer = createHtmlRenderer({
      schema: blockSchema,
      postProcess: () => {
        throw new Error('hook blew up');
      },
    });
    const error = await Effect.runPromise(
      Effect.flip(
        renderer.render({
          type: 'blockDocument',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
        }),
      ),
    );
    expect(error).toBeInstanceOf(HtmlRenderError);
    expect(error.reason).toBe('serialise');
  });
});

// ── sanitiseDocument on its own ───────────────────────────────────────

describe('sanitiseDocument', () => {
  it('drops unsafe link marks and unsafe image children recursively, leaving the rest alone', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'bad',
                  marks: [
                    { type: 'link', attrs: { href: 'javascript:alert(1)' } },
                    { type: 'bold' },
                  ],
                },
                {
                  type: 'text',
                  text: 'good',
                  marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
                },
                { type: 'image', attrs: { src: 'data:text/html,<script>' } },
                { type: 'image', attrs: { src: '/safe.png' } },
              ],
            },
          ],
        },
      ],
    };
    const sanitised = sanitiseDocument(doc);
    const paragraph = sanitised.content![0]!.content![0]!;
    expect(paragraph.content![0]!.marks).toEqual([{ type: 'bold' }]);
    expect(paragraph.content![1]!.marks).toEqual([
      { type: 'link', attrs: { href: 'https://example.com' } },
    ]);
    expect(paragraph.content!.filter((child) => child.type === 'image')).toEqual([
      { type: 'image', attrs: { src: '/safe.png' } },
    ]);
    // Non-mutating.
    expect(doc.content[0]!.content[0]!.content).toHaveLength(4);
  });

  it('leaves a node with no marks and no content untouched', () => {
    expect(sanitiseDocument({ type: 'horizontalRule' })).toEqual({ type: 'horizontalRule' });
  });
});
