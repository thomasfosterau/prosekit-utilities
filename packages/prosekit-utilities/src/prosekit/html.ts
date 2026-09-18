/**
 * HTML generation for editor documents, through ProseKit and a DOM.
 *
 * ProseKit's `htmlFromJSON` serialises through real DOM nodes, so the renderer
 * needs a `Document`. In a browser that is the global one; on a server it is
 * whatever the runtime can provide. See {@link createHtmlRenderer} for how one
 * is chosen and why it must be linkedom rather than happy-dom.
 *
 * Security: {@link sanitiseDocument} runs first on every render, dropping
 * `link` marks and `image` nodes whose URL is not in the safe-URL allow-list.
 * Together with the derived wire schema's decode (`./document-schema.ts`) that
 * is the SEC-XSS-001 defence in the source applications: the schema decides
 * what a document may contain, this decides what a URL may be.
 *
 * @module
 */

import * as Array from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Predicate from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { htmlFromJSON, type NodeJSON as PkNodeJSON } from 'prosekit/core';
import type { Schema as PmSchema } from '@prosekit/pm/model';
import { toEditorDocument } from '../envelope.ts';
import type { DocumentJSON, NodeJSON } from '../json.ts';
import { isSafeHref } from '../url-safety.ts';

/**
 * A render that failed.
 *
 * `dom-unavailable` means no `Document` could be obtained: there is no global
 * one and `linkedom` could not be imported (or a caller-supplied `document`
 * thunk rejected). `serialise` means the document itself could not be turned
 * into HTML — most often a node or mark the compiled schema does not know,
 * which is what `htmlFromJSON` throws on. `cause` carries the original through
 * `Schema.Defect()`, so the error is JSON-encodable and survives a log sink.
 */
export class HtmlRenderError extends Schema.TaggedError<HtmlRenderError>()('HtmlRenderError', {
  reason: Schema.Literals(['dom-unavailable', 'serialise']),
  cause: Schema.Defect(),
}) {}

// ---------------------------------------------------------------------------
// URL sanitisation
// ---------------------------------------------------------------------------

/**
 * A copy of a document tree with every unsafe URL removed: `link` marks whose
 * `href` fails {@link isSafeHref} are dropped from the node that carries them,
 * and `image` children whose `src` fails it are dropped from their parent's
 * content. Recursive, and non-mutating.
 *
 * Dropping the mark rather than the text keeps the prose — an unsafe link
 * renders as plain words — while dropping the whole `image` node is the only
 * option for a leaf whose entire content is its URL.
 *
 * Exported because the same pass belongs at any boundary that hands a document
 * to something which will render it, not only to {@link createHtmlRenderer}.
 */
export function sanitiseDocument(node: NodeJSON): NodeJSON {
  const next: { -readonly [K in keyof NodeJSON]: NodeJSON[K] } = { ...node };
  // `NodeJSON` already declares `marks` and `content`; the array guards stay
  // because a hand-crafted document can carry a non-array value in either.
  if (Array.isArray(node.marks)) {
    next.marks = node.marks.filter((mark) => mark.type !== 'link' || isSafeHref(mark.attrs?.href));
  }
  if (Array.isArray(node.content)) {
    next.content = node.content
      .filter((child) => child.type !== 'image' || isSafeHref(child.attrs?.src))
      .map(sanitiseDocument);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Resolving a Document
// ---------------------------------------------------------------------------

/**
 * The default `Document` source, resolved once per isolate.
 *
 * **Capability detection, not an environment flag.** A browser — and vitest's
 * happy-dom environment — provides a global `document`; every server runtime
 * (Node, workerd) does not. `import.meta.env.SSR` is `false` under vitest's
 * *node* environment, so flag-based branching picks the browser path exactly
 * where it must not.
 *
 * **On the server this must be linkedom, not happy-dom.** happy-dom pulls in
 * `node:child_process` and `node:vm`, which workerd does not provide: the
 * import fails at request time and takes down every page that renders prose.
 * linkedom is pure JavaScript and runs anywhere. It is an optional peer for
 * exactly this reason — a browser-only consumer never installs it, and the
 * import below is never reached.
 *
 * The promise, not the document, is cached: concurrent first renders share one
 * import rather than racing several.
 */
let defaultDocument: Option.Option<Promise<Document>> = Option.none();

const resolveDefaultDocument = (): Promise<Document> => {
  if (Option.isNone(defaultDocument)) {
    const loading = (async (): Promise<Document> => {
      if (!Predicate.isUndefined(globalThis.document)) return globalThis.document;
      const { parseHTML } = await import('linkedom');
      // linkedom's `Document` is a structurally similar but nominally distinct
      // class from lib.dom's; ProseKit only ever calls the shared subset on
      // it. There is no schema to decode through — it is a live DOM object.
      return parseHTML('<!doctype html><html><body></body></html>').document as unknown as Document;
    })();
    defaultDocument = Option.some(loading);
    return loading;
  }
  return defaultDocument.value;
};

// ---------------------------------------------------------------------------
// The renderer
// ---------------------------------------------------------------------------

/** How {@link createHtmlRenderer} builds a renderer. */
export interface HtmlRendererOptions {
  /**
   * The compiled ProseMirror schema to serialise against — pass a
   * `DocumentSchema`'s own `schema` thunk, or a `lazySchema` one. Called per
   * render, so it must be the caching kind.
   */
  readonly schema: () => PmSchema;
  /**
   * A pass over the rendered HTML string, given the same `Document` the render
   * used. This is where a node that serialises to a placeholder element gets
   * its real payload — a diagram block replacing its own `innerHTML` with a
   * server-rendered SVG, say. Runs after serialisation and before the string
   * is returned.
   */
  readonly postProcess?: ((html: string, document: Document) => string) | undefined;
  /**
   * Where the `Document` comes from. Defaults to capability detection: the
   * global `document` if there is one, otherwise linkedom. Resolved once per
   * renderer and cached.
   */
  readonly document?: (() => Promise<Document>) | undefined;
}

/** What {@link createHtmlRenderer} returns. */
export interface HtmlRenderer {
  /** Renders a document to HTML, failing with an {@link HtmlRenderError}. */
  readonly render: (doc: NodeJSON | DocumentJSON) => Effect.Effect<string, HtmlRenderError>;
  /**
   * {@link render} as a promise, rejecting with the {@link HtmlRenderError}
   * itself — for a caller outside Effect, such as a component.
   */
  readonly renderPromise: (doc: NodeJSON | DocumentJSON) => Promise<string>;
}

/**
 * Builds a renderer bound to one compiled schema.
 *
 * ```ts
 * const renderer = createHtmlRenderer({ schema: blockDocumentSchema.schema });
 * const html = await renderer.renderPromise(document);
 * ```
 *
 * A renderer is cheap to create and holds the resolved `Document` promise, so
 * create one per grammar at module scope rather than one per render.
 *
 * Every render sanitises first ({@link sanitiseDocument}), then rewrites the
 * envelope's `type` back to `doc` — the surface name is a persistence rename,
 * and a compiled schema's top node is always `doc`, so feeding the stored
 * shape straight in throws `RangeError: Unknown node type`.
 */
export function createHtmlRenderer(options: HtmlRendererOptions): HtmlRenderer {
  const documentOf = options.document ?? resolveDefaultDocument;
  const postProcess = options.postProcess;

  // Resolved once per renderer: a caller-supplied thunk gets the same
  // once-per-isolate treatment the default already has.
  let resolved: Option.Option<Promise<Document>> = Option.none();
  const documentPromise = (): Promise<Document> => {
    if (Option.isNone(resolved)) {
      const loading = documentOf();
      resolved = Option.some(loading);
      return loading;
    }
    return resolved.value;
  };

  const serialise = (doc: NodeJSON | DocumentJSON, host: Document): string => {
    const editorDocument = toEditorDocument(sanitiseDocument(doc as NodeJSON));
    // `NodeJSON` here is deeply readonly and ProseKit's is not; the two are
    // structural twins otherwise, and nothing downstream mutates the tree.
    const html = htmlFromJSON(editorDocument as unknown as PkNodeJSON, {
      schema: options.schema(),
      document: host,
    });
    return postProcess === undefined ? html : postProcess(html, host);
  };

  const renderPromise = async (doc: NodeJSON | DocumentJSON): Promise<string> => {
    let host: Document;
    try {
      host = await documentPromise();
    } catch (cause) {
      throw new HtmlRenderError({ reason: 'dom-unavailable', cause });
    }
    try {
      return serialise(doc, host);
    } catch (cause) {
      throw new HtmlRenderError({ reason: 'serialise', cause });
    }
  };

  return {
    renderPromise,
    // One implementation, two shapes: the promise is what ProseKit and the DOM
    // hand back, and the Effect wraps it rather than duplicating the branches.
    render: (doc) =>
      Effect.tryPromise({
        try: () => renderPromise(doc),
        catch: (cause) =>
          cause instanceof HtmlRenderError
            ? cause
            : new HtmlRenderError({ reason: 'serialise', cause }),
      }),
  };
}
