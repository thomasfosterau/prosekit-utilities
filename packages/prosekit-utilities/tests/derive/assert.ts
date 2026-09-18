/**
 * Narrowing assertion helpers for this package's tests — the typed replacement
 * for a `!` non-null assertion on a fixture lookup.
 *
 * @module tests/derive/assert
 */

import * as Option from 'effect/Option';
import { expect } from 'vite-plus/test';

/** Asserts `option` is `Option.some`, narrowing to its value for the caller. */
export function expectSome<A>(option: Option.Option<A>, what = 'a value'): A {
  return Option.match(option, {
    onNone: () => expect.fail(`expected Option.some(${what}), got Option.none()`),
    onSome: (value) => value,
  });
}
