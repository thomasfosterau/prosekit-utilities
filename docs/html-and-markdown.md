# HTML and Markdown

Turning a stored document into HTML and Markdown: `createHtmlRenderer` from `@thomasfosterau/prosekit-utilities/prosekit` (server-safe DOM resolution, link and image sanitising, a post-processing hook) and `createMarkdownSerialiser` from the root entry (a stock grammar plus per-application block, inline and mark cases). The API reference is the TSDoc on each export.

## HTML

| Export | Notes |
| --- | --- |
| `sanitiseDocument` | Recursive, non-mutating: drops `link` marks with an unsafe `href` and `image` children with an unsafe `src`. Run automatically by every render; exported for other boundaries. |
| `createHtmlRenderer` | Sanitises, rewrites the envelope's `type` back to `doc`, then `htmlFromJSON`. Cheap to create; holds the resolved `Document` — create one per grammar at module scope, never per render. |
| `HtmlRendererOptions` | `document` defaults to capability detection — the global `document` if defined, otherwise `linkedom`'s `parseHTML(…).document` — resolved once per renderer. |
| `HtmlRenderer` | Two shapes over one implementation; `renderPromise` rejects with the tagged error itself. |
| `HtmlRenderError` | `dom-unavailable` when no `Document` could be obtained; `serialise` when the document or the `postProcess` hook could not produce HTML. |

Rendering with a placeholder-filling hook; [Document surfaces](document-surfaces.md#declaring-a-document-surface) has the full worked example this builds on.

```ts
import { createHtmlRenderer } from '@thomasfosterau/prosekit-utilities/prosekit';
import { blockDocumentSchema } from './document-schemas.ts';

export const blockRenderer = createHtmlRenderer({
  schema: blockDocumentSchema.schema,
  postProcess: (html, document) => expandPlaceholders(html, document),
});

// Inside Effect, with the failure in the error channel:
const program = Effect.gen(function* () {
  const html = yield* blockRenderer.render(post.body);
  return html;
}).pipe(
  Effect.catchTag('HtmlRenderError', (error) =>
    Effect.succeed(error.reason === 'dom-unavailable' ? '' : '<p>Could not render.</p>'),
  ),
);
```

On the server this resolves to `linkedom`, never `happy-dom`: happy-dom pulls in `node:child_process` and `node:vm`, which a Worker runtime does not provide, so the import would fail at request time and take down every page that renders prose. The branch is chosen by capability detection (is there a global `document`?) rather than an `import.meta.env.SSR`-style flag, because that flag reads `false` under a node test environment and would pick the browser path exactly where it must not.

## Markdown

`createMarkdownSerialiser` builds a serialiser from the stock cases (paragraph, heading, blockquote, code block, horizontal rule, image, table, the flat-list model, hard break, five marks); the `blocks`, `inlines` and `marks` option maps merge over them. `toMarkdown` is the default instance. `document` returns trimmed multi-line Markdown and `inline` a trimmed single line. A `BlockSerialiser` or `InlineSerialiser` receives a `MarkdownContext` (`serialiseInline`, `serialiseBlocks`, `escape`) so it renders its children exactly as the stock cases do; return `''` to drop the node. A `MarkSerialiser` wraps already-rendered text.

| Export | Notes |
| --- | --- |
| `mentionMarkdown` | A mention as its escaped `@label`; the id has no Markdown form. |
| `figureMarkdown` | The image line followed by the caption as an italic paragraph. |
| `sidenoteMarkdown` | The Pandoc inline footnote form, `^[…]`. A nested sidenote is flattened to its body first. |
| `escapeMarkdown` | Backslash-escapes the CommonMark inline metacharacters. Exported for an application's own serialisers. |

```ts
import {
  createMarkdownSerialiser,
  figureMarkdown,
  mentionMarkdown,
} from '@thomasfosterau/prosekit-utilities';

const toMarkdown = createMarkdownSerialiser({
  blocks: { figure: figureMarkdown },
  inlines: { mention: mentionMarkdown },
  marks: { highlight: (text) => `==${text}==` },
});

toMarkdown.document(post.body); // multi-line Markdown
toMarkdown.inline(post.title); // one line
```
