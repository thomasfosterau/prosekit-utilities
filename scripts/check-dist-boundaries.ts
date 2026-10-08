/**
 * Enforces the entry-point import boundaries against the BUILT `dist/` —
 * the files a consumer actually loads — rather than against `src/`.
 *
 * For each guarded entry point it resolves every file the package's `exports`
 * maps the entry to, under every condition but `types` (`import`, `node`,
 * `browser`, `svelte`, `default`, …), then walks the emitted module graph
 * from each: every static import, re-export, dynamic `import()` and
 * `require()` call of a relative `.js` / `.mjs` file is followed into the shared chunks it reaches,
 * and every specifier on the way — bare or relative — is checked against the
 * entry's forbidden list. A relative `.svelte` or `.css` import is a leaf:
 * checked by name, never opened. Specifiers are read with the oxc parser
 * Vite+ ships, so a comment or string that merely mentions a package never
 * counts, and a type-only import never survives into `.js`.
 *
 * It is fail-closed: it fails — never skips — when a built entry is missing
 * or lies outside the package's `dist/`, when a dynamic `import()` or a
 * `require()` has no literal specifier, when `require` is used other than as
 * a direct call, when a file imports `module` / `node:module` (whose
 * `createRequire()` hands out a `require` the walk cannot trace), when a
 * relative import leaves `dist/` (into `src/`, `node_modules/`, …, lexically
 * or through a symlink) or names a file it does not open as a module
 * (extensionless, `.json`, `.cjs`, anything but the `.svelte` and `.css`
 * leaves) or that does not exist, when a specifier is neither relative nor a
 * bare package name (empty, containing a control character, a `#` subpath
 * import, an absolute path, or a URL other than a `node:` builtin), and when a
 * positive control cannot see the import it must see (so the walk can never
 * pass vacuously).
 *
 * Run it after the build: `vp run check:dist` (the root task depends on every
 * package's `build`). The boundaries themselves are documented in each
 * package's CLAUDE.md § Boundary.
 */

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'vite-plus';

/** One guarded entry point and the bare specifiers it must never reach. */
interface Boundary {
  /** The workspace directory of the package, relative to the repo root. */
  readonly packageDir: string;
  /** The `exports` key of the entry point, e.g. `.` or `./node`. */
  readonly entry: string;
  /** Why the entry must stay clear, printed with a violation. */
  readonly reason: string;
  /** Matches a forbidden bare specifier, or a forbidden relative file. */
  readonly forbidden: RegExp;
}

/**
 * A positive control: an entry whose graph MUST reach a matching specifier.
 * If the walk cannot see it, the walk itself is broken and every boundary
 * above would pass vacuously.
 */
interface Control {
  readonly packageDir: string;
  readonly entry: string;
  readonly required: RegExp;
}

/**
 * `prosekit`, any `prosekit/*` subpath, any `@prosekit/*` package, and this
 * package's own `./prosekit` entry reached by name. The core's `.`,
 * `./derive` and `./drizzle` stay allowed.
 */
const PROSEKIT =
  /^(?:prosekit(?:\/|$)|@prosekit\/|@thomasfosterau\/prosekit-utilities\/prosekit(?:\/|$))/;

/**
 * Svelte itself, the xyflow engine, the Svelte component packages this
 * workspace depends on, ProseKit's Svelte bindings (`prosekit/svelte`,
 * `@prosekit/svelte` and their subpaths — the only ProseKit entries whose
 * runtime imports Svelte), any compiled `.svelte` module, and this package's
 * own canvas root (or any subpath but `./node`) reached by name. Every other
 * `prosekit/*` subpath stays allowed: `./node` imports `prosekit/core`.
 */
const SVELTE_OR_XYFLOW =
  /^(?:svelte(?:\/|$)|@xyflow\/|bits-ui(?:\/|$)|@?prosekit\/svelte(?:\/|$)|@thomasfosterau\/prosekit-svelte(?:\/|$)|@thomasfosterau\/prosekit-flowchart(?:$|\/(?!node$)))|\.svelte(?:\.js)?$/;

const CORE = 'packages/prosekit-utilities';
const FLOWCHART = 'packages/prosekit-flowchart';

const PROSEKIT_FREE =
  'this entry is ProseKit-free: a browser bundle that imports it must not pull in the editor runtime';

const BOUNDARIES: ReadonlyArray<Boundary> = [
  { packageDir: CORE, entry: '.', reason: PROSEKIT_FREE, forbidden: PROSEKIT },
  { packageDir: CORE, entry: './derive', reason: PROSEKIT_FREE, forbidden: PROSEKIT },
  { packageDir: CORE, entry: './drizzle', reason: PROSEKIT_FREE, forbidden: PROSEKIT },
  {
    packageDir: FLOWCHART,
    entry: './node',
    reason: './node imports no Svelte and no xyflow, so a server and any bundle can load it',
    forbidden: SVELTE_OR_XYFLOW,
  },
];

const CONTROLS: ReadonlyArray<Control> = [
  { packageDir: CORE, entry: './prosekit', required: PROSEKIT },
  { packageDir: FLOWCHART, entry: './node', required: /^prosekit(?:\/|$)/ },
];

/** A bare specifier reached from an entry, with the chain of files that led to it. */
interface Reached {
  readonly specifier: string;
  readonly chain: ReadonlyArray<string>;
}

/** The outcome of walking one entry's emitted module graph. */
interface Walk {
  readonly reached: ReadonlyArray<Reached>;
  readonly problems: ReadonlyArray<string>;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const show = (file: string): string => relative(root, file);
/** A specifier as a double-quoted, escaped string, so a control character prints visibly. */
const quote = (specifier: string): string => JSON.stringify(specifier);

/**
 * Every runtime target of a conditional `exports` value: the strings under
 * every condition except `types`, through nested conditions and fallback
 * arrays.
 */
const runtimeTargets = (value: unknown): Array<string> => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(runtimeTargets);
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([condition, target]) =>
      condition === 'types' ? [] : runtimeTargets(target),
    );
  }
  return [];
};

/** The built output directory of a workspace package: everything a walk may open. */
const distOf = (packageDir: string): string => resolve(root, packageDir, 'dist');

/** Whether `file` lies outside `directory` (or is `directory` itself). */
const isOutside = (directory: string, file: string): boolean => {
  const path = relative(directory, file);
  return path === '' || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
};

/**
 * Every file an `exports` entry resolves to at runtime, deduplicated, or an
 * error message. Each must lie under the package's `dist/`, because only the
 * built output is what the check proves anything about.
 */
const resolveEntry = (packageDir: string, entry: string): Array<string> | Error => {
  const manifestPath = resolve(root, packageDir, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    exports?: Record<string, unknown>;
  };
  const targets = runtimeTargets(manifest.exports?.[entry]);
  if (targets.length === 0) {
    return new Error(`${show(manifestPath)} has no runtime target for exports["${entry}"]`);
  }
  const files = [...new Set(targets.map((target) => resolve(root, packageDir, target)))];
  const outside = files.filter((file) => isOutside(distOf(packageDir), file));
  if (outside.length > 0) {
    return new Error(
      `${outside.map(show).join(', ')} (exports["${entry}"] of ${packageDir}) is not under dist/, so the boundary cannot be proven`,
    );
  }
  const missing = files.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    return new Error(
      `${missing.map(show).join(', ')} (exports["${entry}"] of ${packageDir}) does not exist — run \`vp run -r build\` first`,
    );
  }
  return files;
};

/**
 * A relative module the walk opens and follows. Not `.cjs`: its `require()`
 * calls are invisible to the walk, and every package here is
 * `"type": "module"`, so one fails as "not a resolvable .js module".
 */
const WALKED = /\.m?js$/;

/** A relative module the walk checks by name only: a compiled component or a stylesheet. */
const LEAF = /\.(?:svelte|css)$/;

/** A URL scheme, e.g. `file:`, `data:`, `https:` — or `node:`, the one allowed. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Why a non-relative specifier is not a plain bare package name the forbidden
 * lists can judge, or `undefined` when it is one. A `node:` builtin is bare.
 */
const unprovable = (specifier: string): string | undefined => {
  if (specifier === '') return 'an empty specifier';
  // oxlint-disable-next-line no-control-regex -- matching control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(specifier)) return 'a specifier with a control character';
  if (specifier.startsWith('#'))
    return 'a package.json `imports` subpath, resolved outside the walk';
  if (specifier.startsWith('/')) return 'an absolute path';
  if (URL_SCHEME.test(specifier) && !specifier.startsWith('node:')) return 'a URL';
  return undefined;
};

/**
 * `module` / `node:module`: its `createRequire()` returns a `require` under
 * any name, passed anywhere, which no lexical walk can trace reliably — so
 * importing the module at all fails instead.
 */
const MODULE_LOADER = /^(?:node:)?module$/;

/** An ESTree node as the oxc parser emits it. */
interface AstNode {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly [key: string]: unknown;
}

const isNode = (value: unknown): value is AstNode =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string';

/** Whether `node` is the identifier or non-computed member `require`. */
const isRequire = (node: unknown): boolean =>
  isNode(node) &&
  ((node.type === 'Identifier' && node['name'] === 'require') ||
    (node.type === 'MemberExpression' &&
      node['computed'] === false &&
      isNode(node['property']) &&
      node['property']['name'] === 'require'));

/** The string a `require()` argument names, when it is a literal. */
const literalString = (node: unknown): string | undefined => {
  if (!isNode(node)) return undefined;
  if (node.type === 'Literal' && typeof node['value'] === 'string') return node['value'];
  if (node.type === 'TemplateLiteral') {
    const quasis = node['quasis'];
    const expressions = node['expressions'];
    if (Array.isArray(quasis) && Array.isArray(expressions) && expressions.length === 0) {
      const only: unknown = quasis[0];
      if (isNode(only) && typeof only['value'] === 'object' && only['value'] !== null) {
        const cooked = (only['value'] as { cooked?: unknown }).cooked;
        if (typeof cooked === 'string') return cooked;
      }
    }
  }
  return undefined;
};

/**
 * Every `require()` call in a parsed program. Rolldown and other bundlers
 * resolve a `require()` inside ESM, so it is as much an import as
 * `import()`. A call with a literal argument yields a specifier; one with
 * any other argument, and any use of the `require` identifier other than as
 * a direct call (`const r = require`), is a problem.
 */
const requiresOf = (
  file: string,
  source: string,
  program: unknown,
): { specifiers: Array<string>; problems: Array<string> } => {
  const specifiers: Array<string> = [];
  const problems: Array<string> = [];
  const stack: Array<{ node: AstNode; parent: AstNode | undefined; key: string }> = [];
  if (isNode(program)) stack.push({ node: program, parent: undefined, key: '' });
  for (let next = stack.pop(); next !== undefined; next = stack.pop()) {
    const { node, parent, key } = next;
    if (node.type === 'CallExpression' && isRequire(node['callee'])) {
      const args = node['arguments'];
      const first: unknown = Array.isArray(args) ? args[0] : undefined;
      const literal = Array.isArray(args) && args.length === 1 ? literalString(first) : undefined;
      if (literal === undefined) {
        problems.push(
          `${show(file)}: ${source.slice(node.start, node.end)} has no literal specifier, so the boundary cannot be proven`,
        );
      } else {
        specifiers.push(literal);
      }
    } else if (
      node.type === 'Identifier' &&
      node['name'] === 'require' &&
      !(parent?.type === 'CallExpression' && key === 'callee') &&
      !(
        parent?.type === 'MemberExpression' &&
        key === 'property' &&
        parent['computed'] === false
      ) &&
      !(
        (parent?.type === 'Property' ||
          parent?.type === 'PropertyDefinition' ||
          parent?.type === 'MethodDefinition') &&
        key === 'key' &&
        parent['computed'] === false
      )
    ) {
      problems.push(
        `${show(file)}: uses \`require\` other than as a direct call (at offset ${node.start}), so the boundary cannot be proven`,
      );
    }
    for (const [childKey, child] of Object.entries(node)) {
      if (childKey === 'parent') continue;
      const children: Array<unknown> = Array.isArray(child) ? child : [child];
      for (const item of children) {
        if (isNode(item)) stack.push({ node: item, parent: node, key: childKey });
      }
    }
  }
  return { specifiers, problems };
};

/** Every module specifier one emitted file requests: imports, re-exports, `import()` and `require()`. */
const specifiersOf = (file: string): { specifiers: Array<string>; problems: Array<string> } => {
  const source = readFileSync(file, 'utf8');
  const { program, module, errors } = parseSync(file, source);
  const problems = errors.map((error) => `${show(file)}: parse error: ${error.message}`);
  const specifiers: Array<string> = [];
  for (const entry of module.staticImports) specifiers.push(entry.moduleRequest.value);
  for (const statement of module.staticExports) {
    for (const entry of statement.entries) {
      if (entry.moduleRequest !== null) specifiers.push(entry.moduleRequest.value);
    }
  }
  for (const dynamic of module.dynamicImports) {
    const argument = source.slice(dynamic.moduleRequest.start, dynamic.moduleRequest.end).trim();
    const literal = /^(['"`])([^'"`$]*)\1$/.exec(argument);
    if (literal?.[2] === undefined) {
      problems.push(
        `${show(file)}: import(${argument}) has no literal specifier, so the boundary cannot be proven`,
      );
    } else {
      specifiers.push(literal[2]);
    }
  }
  const required = requiresOf(file, source, program);
  specifiers.push(...required.specifiers);
  problems.push(...required.problems);
  return { specifiers, problems };
};

/**
 * Walks the relative-import graph from `entryFiles`, collecting every
 * specifier it requests. A relative specifier is collected too (so a
 * `.svelte` module is caught by name); it must stay under `distDir` and,
 * unless it is a `.svelte` or `.css` leaf, must be a `.js` / `.mjs` file that
 * exists — and whose real path, symlinks resolved, also stays under
 * `distDir`, since Node resolves a module's own imports from its real path.
 * A non-relative specifier must be a bare package name (`node:` builtins
 * included), other than `module` / `node:module`. Anything else is reported
 * as a boundary that cannot be proven.
 */
const walk = (distDir: string, entryFiles: ReadonlyArray<string>): Walk => {
  const reached: Array<Reached> = [];
  const problems: Array<string> = [];
  const seen = new Set<string>();
  const realDist = realpathSync(distDir);
  const queue: Array<{ file: string; chain: ReadonlyArray<string> }> = [];
  for (const file of entryFiles) {
    const real = realpathSync(file);
    if (isOutside(realDist, real)) {
      problems.push(
        `${show(file)} is a symlink to ${show(real)}, which leaves dist/, so the boundary cannot be proven`,
      );
    } else {
      queue.push({ file: real, chain: [show(real)] });
    }
  }
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (seen.has(next.file)) continue;
    seen.add(next.file);
    const parsed = specifiersOf(next.file);
    problems.push(...parsed.problems);
    for (const specifier of new Set(parsed.specifiers)) {
      reached.push({ specifier, chain: next.chain });
      if (!specifier.startsWith('.')) {
        const shape = unprovable(specifier);
        if (shape !== undefined) {
          problems.push(
            `${show(next.file)}: imports ${quote(specifier)}, ${shape}, not a bare package name, so the boundary cannot be proven`,
          );
        } else if (MODULE_LOADER.test(specifier)) {
          problems.push(
            `${show(next.file)}: imports ${quote(specifier)}, whose createRequire() loads modules the walk cannot trace, so the boundary cannot be proven`,
          );
        }
        continue;
      }
      const target = resolve(dirname(next.file), specifier);
      if (isOutside(distDir, target)) {
        problems.push(
          `${show(next.file)}: imports ${quote(specifier)}, which leaves dist/, so the boundary cannot be proven`,
        );
        continue;
      }
      if (LEAF.test(target)) continue;
      if (!WALKED.test(target)) {
        problems.push(
          `${show(next.file)}: imports ${quote(specifier)}: not a resolvable .js module, so the boundary cannot be proven`,
        );
        continue;
      }
      if (!existsSync(target)) {
        problems.push(`${show(next.file)}: imports ${quote(specifier)}, which does not exist`);
        continue;
      }
      const real = realpathSync(target);
      if (isOutside(realDist, real)) {
        problems.push(
          `${show(next.file)}: imports ${quote(specifier)}, a symlink to ${show(real)}, which leaves dist/, so the boundary cannot be proven`,
        );
        continue;
      }
      queue.push({ file: real, chain: [...next.chain, show(real)] });
    }
  }
  return { reached, problems };
};

const failures: Array<string> = [];
let checked = 0;

for (const boundary of BOUNDARIES) {
  const label = `${boundary.packageDir} exports["${boundary.entry}"]`;
  const entryFiles = resolveEntry(boundary.packageDir, boundary.entry);
  if (entryFiles instanceof Error) {
    failures.push(`${label}: ${entryFiles.message}`);
    continue;
  }
  const result = walk(distOf(boundary.packageDir), entryFiles);
  failures.push(...result.problems.map((problem) => `${label}: ${problem}`));
  for (const { specifier, chain } of result.reached) {
    if (boundary.forbidden.test(specifier)) {
      failures.push(
        `${label} reaches forbidden import ${quote(specifier)} via ${chain.join(' -> ')}\n    (${boundary.reason})`,
      );
    }
  }
  checked += 1;
}

for (const control of CONTROLS) {
  const label = `${control.packageDir} exports["${control.entry}"]`;
  const entryFiles = resolveEntry(control.packageDir, control.entry);
  if (entryFiles instanceof Error) {
    failures.push(`${label}: ${entryFiles.message}`);
    continue;
  }
  const result = walk(distOf(control.packageDir), entryFiles);
  if (!result.reached.some(({ specifier }) => control.required.test(specifier))) {
    failures.push(
      `${label}: positive control failed — the walk found no import matching ${String(control.required)}, so the boundary checks cannot be trusted`,
    );
  }
}

if (failures.length > 0) {
  console.error(`check:dist — ${failures.length} entry-point boundary failure(s):\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `check:dist — ${checked} entry-point boundaries hold in dist/ (${CONTROLS.length} positive controls seen)`,
  );
}
