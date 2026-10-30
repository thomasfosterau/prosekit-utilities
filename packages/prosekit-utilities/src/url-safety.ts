/**
 * The safe-URL allow-list shared by every serialiser in this package.
 *
 * Link `href`s and image `src`s are passed through this allow-list before
 * being embedded, so a serialiser never emits a `javascript:` / `data:` /
 * `vbscript:` URI. Single-sourced here so the Markdown serialiser, the HTML
 * serialiser (the ProseKit entry point) and the allow-list write-seam check can never
 * drift apart — the SEC-XSS-001 defence-in-depth both apps this package was
 * extracted from rely on.
 *
 * @module
 */

import * as Predicate from 'effect/Predicate';
import * as Result from 'effect/Result';
import * as String from 'effect/String';

/**
 * The schemes {@link isSafeHref} accepts when the caller names none.
 *
 * Deliberately short: these are the three a rich-text document has a reason
 * to link to. An application that needs `tel:` or a custom scheme passes it
 * in rather than widening the default for everyone.
 */
export const DEFAULT_SAFE_SCHEMES: ReadonlyArray<string> = ['http', 'https', 'mailto'];

/** Normalises `https:` / `HTTPS` / `https` to the `https:` form `URL#protocol` reports. */
const asProtocol = (scheme: string): string => {
  const lower = scheme.trim().toLowerCase();
  return lower.endsWith(':') ? lower : `${lower}:`;
};

/**
 * Returns true when `href` is safe to embed as a link target or image
 * source.
 *
 * Allowed: any of `options.schemes` (default `http`, `https`, `mailto`),
 * root-relative paths (`/foo`, but not `//evil.example` or `/\evil.example`,
 * both of which resolve off-origin), and fragment links (`#bar`).
 *
 * The scheme is read off `new URL()` rather than compared as a string
 * prefix, which is what makes the obfuscated forms fail: the WHATWG parser
 * lowercases the scheme and strips leading and inner ASCII whitespace and
 * control characters before reporting it, so `JaVaScRiPt:`, `  javascript:`
 * and `java\tscript:` all normalise to `javascript:` and are rejected. A
 * `startsWith('javascript:')` test would pass all three.
 */
export function isSafeHref(
  href: unknown,
  options?: { readonly schemes?: ReadonlyArray<string> | undefined },
): href is string {
  if (!Predicate.isString(href)) return false;
  const trimmed = href.trim();
  if (String.isEmpty(trimmed)) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return true;
  }
  if (trimmed.startsWith('#')) return true;
  // Use URL parsing to extract the protocol; if parsing fails, reject.
  const parsed = Result.try(() => new URL(trimmed));
  if (Result.isFailure(parsed)) return false;
  const protocol = parsed.success.protocol.toLowerCase();
  const schemes = options?.schemes ?? DEFAULT_SAFE_SCHEMES;
  return schemes.some((scheme) => asProtocol(scheme) === protocol);
}
