/**
 * CommonMark escaping for literal text.
 *
 * @module
 */

/** Every CommonMark inline metacharacter, in one class. */
const METACHARACTERS = /([\\`*_{}[\]()#+\-.!<>|~])/g;

/**
 * Backslash-escapes the CommonMark inline metacharacters in literal text, so
 * an author's `*` stays an asterisk instead of opening emphasis.
 *
 * Exported because an application's own node serialiser emits literal text
 * too — a mention's `@label`, a caption — and must escape it the same way
 * the stock serialisers do.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(METACHARACTERS, '\\$1');
}
