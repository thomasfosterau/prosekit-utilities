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
 * It also enforces the `"sideEffects": false` claim over every `.js`, `.mjs`
 * and `.svelte` file in each package's `dist/` (`sideEffects` below): no bare
 * side-effect import but the three allow-listed stylesheets, no top-level
 * statement other than a declaration, import or export, and no load-time
 * effect inside a declaration — an `await`, an assignment, or a call that is
 * not `/* @__PURE__ *\/`-annotated (the one exception, `isSymbolFor`, is a
 * direct `Symbol.for` call with a single string-literal key, where `Symbol`
 * isn't shadowed). A component's `<script module>` gets every rule; its
 * instance `<script>` runs per component, so only its imports are checked.
 *
 * Run it after the build: `vp run check:dist` (the root task depends on every
 * package's `build`). The boundaries themselves are documented in each
 * package's CLAUDE.md § Boundary.
 */

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseSvelte } from 'svelte/compiler';
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
 * runtime imports Svelte), the Svelte-runtime packages those pull in and a
 * hoisted `node_modules/` makes importable from here (`@prosemirror-adapter/svelte`
 * under `@prosekit/svelte`; `runed` and `svelte-toolbelt` under `bits-ui`),
 * any compiled `.svelte` module, and this package's own canvas root (or any
 * subpath but `./node`) reached by name. Every other `prosekit/*` subpath
 * stays allowed: `./node` imports `prosekit/core`.
 */
const SVELTE_OR_XYFLOW =
  /^(?:svelte(?:\/|$)|@xyflow\/|bits-ui(?:\/|$)|runed(?:\/|$)|svelte-toolbelt(?:\/|$)|@prosemirror-adapter\/svelte(?:\/|$)|@?prosekit\/svelte(?:\/|$)|@thomasfosterau\/prosekit-svelte(?:\/|$)|@thomasfosterau\/prosekit-flowchart(?:$|\/(?!node$)))|\.svelte(?:\.js)?$/;

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
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const exportsField: unknown =
    typeof manifest === 'object' && manifest !== null && 'exports' in manifest
      ? manifest.exports
      : undefined;
  const targets = runtimeTargets(
    typeof exportsField === 'object' && exportsField !== null
      ? new Map<string, unknown>(Object.entries(exportsField)).get(entry)
      : undefined,
  );
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

// ---------------------------------------------------------------------------
// The `"sideEffects": false` claim: evaluating any emitted module has no
// observable effect, so a consumer's bundler may drop one whose exports go
// unused.
// ---------------------------------------------------------------------------

/**
 * Every workspace package, whose whole `dist/` the `"sideEffects": false`
 * check reads — listed from `packages/`, so a new package is covered (and
 * fails until built) without editing this file.
 */
const PUBLISHED: ReadonlyArray<string> = readdirSync(resolve(root, 'packages'), {
  withFileTypes: true,
})
  .filter(
    (entry) =>
      entry.isDirectory() && existsSync(resolve(entry.parentPath, entry.name, 'package.json')),
  )
  .map((entry) => `packages/${entry.name}`)
  .toSorted();

/**
 * The only bare side-effect imports `dist/` may carry: the stylesheets of
 * another package, each inside the one component that owns it (see the root
 * AGENTS.md on `"sideEffects": false`). Each is also a positive control — the
 * check fails if it cannot see one, so a broken `<script>` extraction can
 * never pass vacuously.
 */
const ALLOWED_BARE_IMPORTS: ReadonlyArray<{ readonly file: string; readonly specifier: string }> = [
  {
    file: 'packages/prosekit-svelte/dist/editor/Editor.svelte',
    specifier: 'prosekit/basic/style.css',
  },
  {
    file: 'packages/prosekit-svelte/dist/editor/Editor.svelte',
    specifier: 'prosekit/basic/typography.css',
  },
  {
    file: 'packages/prosekit-flowchart/dist/Flowchart.svelte',
    specifier: '@xyflow/svelte/dist/style.css',
  },
];

/** A module the purity check reads: emitted JavaScript or a shipped component. */
const PURITY_CHECKED = /\.(?:m?js|svelte)$/;

/**
 * A top-level statement that only declares: evaluating it binds names and
 * evaluates nothing else, except the initialisers and class members
 * `loadTimeEffects` inspects. TypeScript-only declarations appear only in a
 * `.svelte` `<script lang="ts">`, and erase.
 */
const DECLARATION = new Set([
  'ImportDeclaration',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'ExportAllDeclaration',
  'FunctionDeclaration',
  'ClassDeclaration',
  'VariableDeclaration',
  'EmptyStatement',
  'TSTypeAliasDeclaration',
  'TSInterfaceDeclaration',
]);

/**
 * Whether a call is a direct `Symbol.for` call with a single string-literal key,
 * where `Symbol` isn't shadowed — the one call this check trusts by name, so a
 * module may make it while it loads without a `/* @__PURE__ *\/` annotation.
 * It is an idempotent read-or-insert on the engine's symbol registry, which no
 * code can enumerate: dropping an unused call is unobservable, because a later
 * `Symbol.for` of the same key returns the same symbol either way. Bundlers
 * know this too: esbuild drops an unused `const k = Symbol.for('…')` without an
 * annotation, so trusting exactly that shape hides nothing a consumer's bundle
 * would keep.
 *
 * The shape is narrow because esbuild's is: it keeps the call (and its
 * constant) when the key is an identifier, an object (whose `toString` could
 * run anything), a template with an expression, or there is more than one
 * argument, and when `Symbol` is any module-level binding — an import, a
 * function or class declaration, or a name inside a destructuring pattern.
 * So only `Symbol.for('…')`, or a template key with no `${}`, counts — written
 * with a plain `.for`, no optional chaining — and only in a module with no
 * top-level `Symbol` (`topLevelNamesOf`).
 *
 * Everything else called at load — Effect's `Schema` / `Option`, any other
 * import, the workspace's own factories (`required`, `createMarkdownSerialiser`),
 * a local helper — fails until it is annotated `/* @__PURE__ *\/` in source:
 * a consumer's bundler keeps an unannotated call (and the constant it
 * initialises) whatever this check believes, so only the annotation at the
 * call site counts.
 */
const isSymbolFor = (call: AstNode, topLevel: ReadonlySet<string>): boolean => {
  const callee = call['callee'];
  const args = call['arguments'];
  if (!isNode(callee) || callee.type !== 'MemberExpression') return false;
  if (callee['computed'] !== false || callee['optional'] === true || call['optional'] === true)
    return false;
  const object = callee['object'];
  const property = callee['property'];
  if (
    !isNode(object) ||
    object.type !== 'Identifier' ||
    object['name'] !== 'Symbol' ||
    topLevel.has('Symbol') ||
    !isNode(property) ||
    property.type !== 'Identifier' ||
    property['name'] !== 'for'
  )
    return false;
  if (!Array.isArray(args) || args.length !== 1) return false;
  const key: unknown = args[0];
  if (!isNode(key)) return false;
  if (key.type === 'Literal' || key.type === 'StringLiteral') {
    return typeof key['value'] === 'string';
  }
  return (
    key.type === 'TemplateLiteral' &&
    Array.isArray(key['expressions']) &&
    key['expressions'].length === 0
  );
};

/** A node's source, whitespace collapsed and cut to one short line, for a failure message. */
const snippet = (source: string, node: AstNode): string => {
  const flat = source.slice(node.start, node.end).replace(/\s+/g, ' ');
  return flat.length > 60 ? `${flat.slice(0, 57)}...` : flat;
};

/** The 1-based line of `offset` in `source`. */
const lineOf = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length;

/** The children of an AST node, in no particular order. */
const childrenOf = (node: AstNode): Array<{ key: string; child: AstNode }> =>
  Object.entries(node).flatMap(([key, value]) => {
    if (key === 'parent') return [];
    const items: Array<unknown> = Array.isArray(value) ? value : [value];
    return items.filter(isNode).map((child) => ({ key, child }));
  });

/**
 * The name of every top-level binding of a parsed program — its imports
 * (default, named and namespace), its function and class declarations, and
 * every name its variable declarations bind, destructuring patterns included —
 * so a module-level `Symbol` of any kind shadows the global.
 */
const topLevelNamesOf = (body: ReadonlyArray<AstNode>): Set<string> => {
  const names = new Set<string>();
  // Walks a binding pattern down to the identifiers it binds: an object
  // pattern's property values and rest, an array pattern's elements, a rest
  // element's argument and a default's left-hand side.
  const declare = (node: unknown): void => {
    if (!isNode(node)) return;
    switch (node.type) {
      case 'Identifier':
        names.add(String(node['name']));
        break;
      case 'ObjectPattern': {
        const properties = node['properties'];
        for (const property of Array.isArray(properties) ? properties : []) {
          if (!isNode(property)) continue;
          declare(property.type === 'RestElement' ? property : property['value']);
        }
        const rest = node['rest'];
        if (isNode(rest)) declare(rest);
        break;
      }
      case 'ArrayPattern': {
        const elements = node['elements'];
        for (const element of Array.isArray(elements) ? elements : []) declare(element);
        const rest = node['rest'];
        if (isNode(rest)) declare(rest);
        break;
      }
      case 'RestElement':
      case 'BindingRestElement':
        declare(node['argument']);
        break;
      case 'AssignmentPattern':
        declare(node['left']);
        break;
      default:
        break;
    }
  };
  for (const raw of body) {
    const statement =
      (raw.type === 'ExportNamedDeclaration' || raw.type === 'ExportDefaultDeclaration') &&
      isNode(raw['declaration'])
        ? raw['declaration']
        : raw;
    if (statement.type === 'ImportDeclaration') {
      const specifiers = statement['specifiers'];
      for (const specifier of Array.isArray(specifiers) ? specifiers : []) {
        if (isNode(specifier)) declare(specifier['local']);
      }
    } else if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') {
      // `export default function Symbol() {}` is a declaration, so it lands here too.
      declare(statement['id']);
    } else if (statement.type === 'VariableDeclaration') {
      const declarations = statement['declarations'];
      for (const declarator of Array.isArray(declarations) ? declarations : []) {
        if (isNode(declarator)) declare(declarator['id']);
      }
    }
  }
  return names;
};

/**
 * The offsets just past each `/* @__PURE__ *\/` (or `#__PURE__`) comment: a
 * call or `new` whose start follows one, whitespace aside, is annotated pure —
 * the bundler's own contract, which rolldown emits for its `__exportAll`
 * namespace objects.
 */
const pureAnnotationEnds = (
  comments: ReadonlyArray<{ readonly value: string; readonly end: number }>,
): Set<number> =>
  new Set(comments.filter(({ value }) => /^\s*[@#]__PURE__\s*$/.test(value)).map(({ end }) => end));

/**
 * Why each expression a module evaluates while it loads may have an effect:
 * walks a top-level declaration's initialisers, class heritage, static members,
 * decorators and computed keys — never a function body or an instance member,
 * which run later, if ever — and reports any `await`, assignment, update,
 * `delete`, dynamic `import()`, static block, decorator, or a call, `new` or
 * tagged template that is not annotated pure (bar the `Symbol.for` shape
 * `isSymbolFor` admits).
 */
const loadTimeEffects = (
  program: AstNode,
  source: string,
  topLevel: ReadonlySet<string>,
  pure: ReadonlySet<number>,
): Array<{ offset: number; reason: string }> => {
  const found: Array<{ offset: number; reason: string }> = [];
  const annotated = (node: AstNode): boolean => {
    let at = node.start;
    while (at > 0 && /\s/.test(source[at - 1] ?? '')) at -= 1;
    return pure.has(at);
  };
  const text = (node: AstNode): string => snippet(source, node);
  const stack: Array<AstNode> = [program];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    switch (node.type) {
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'FunctionDeclaration':
        continue;
      case 'AwaitExpression':
        found.push({ offset: node.start, reason: 'a top-level `await`' });
        break;
      case 'AssignmentExpression':
      case 'UpdateExpression':
        found.push({ offset: node.start, reason: `an assignment at load: ${text(node)}` });
        break;
      case 'UnaryExpression':
        if (node['operator'] === 'delete') {
          found.push({ offset: node.start, reason: `a \`delete\` at load: ${text(node)}` });
        }
        break;
      case 'ImportExpression':
        found.push({ offset: node.start, reason: `a dynamic import() at load: ${text(node)}` });
        break;
      case 'StaticBlock':
        found.push({ offset: node.start, reason: 'a class `static` block, which runs at load' });
        continue;
      case 'Decorator':
        found.push({
          offset: node.start,
          reason: `a decorator, which runs at load: ${text(node)}`,
        });
        break;
      case 'CallExpression':
      case 'NewExpression':
      case 'TaggedTemplateExpression': {
        const allowed =
          annotated(node) || (node.type === 'CallExpression' && isSymbolFor(node, topLevel));
        if (!allowed) {
          found.push({
            offset: node.start,
            reason: `a call at load that is not annotated /* @__PURE__ */: ${text(node)}`,
          });
        }
        break;
      }
      case 'ClassBody': {
        // Only static members and computed keys run when the class is defined.
        const members = node['body'];
        for (const member of Array.isArray(members) ? members : []) {
          if (!isNode(member)) continue;
          if (member['computed'] === true && isNode(member['key'])) stack.push(member['key']);
          const decorators = member['decorators'];
          for (const decorator of Array.isArray(decorators) ? decorators : []) {
            if (isNode(decorator)) stack.push(decorator);
          }
          if (member.type === 'StaticBlock') stack.push(member);
          else if (member['static'] === true && member.type !== 'MethodDefinition') {
            if (isNode(member['value'])) stack.push(member['value']);
          }
        }
        continue;
      }
      default:
        break;
    }
    for (const { child } of childrenOf(node)) stack.push(child);
  }
  return found;
};

/**
 * Why one parsed program is not side-effect-free. `bareAllowed` lists the
 * bare imports this file may carry; `statements` is false for a `.svelte`
 * instance script, whose top level runs per component, not at module load —
 * only its imports are hoisted to the module.
 */
const programEffects = (
  file: string,
  source: string,
  parsed: { program: unknown; comments: ReadonlyArray<{ value: string; end: number }> },
  options: { statements: boolean; bareAllowed: ReadonlySet<string>; seen: Set<string> },
): Array<string> => {
  const problems: Array<string> = [];
  const at = (offset: number): string => `${show(file)}:${lineOf(source, offset)}`;
  const program = parsed.program;
  const body: Array<AstNode> =
    isNode(program) && Array.isArray(program['body']) ? program['body'].filter(isNode) : [];
  const topLevel = topLevelNamesOf(body);
  const pure = pureAnnotationEnds(parsed.comments);
  for (const statement of body) {
    const bareSource =
      (statement.type === 'ImportDeclaration' ||
        (statement.type === 'ExportNamedDeclaration' && isNode(statement['source']))) &&
      Array.isArray(statement['specifiers']) &&
      statement['specifiers'].length === 0 &&
      statement['importKind'] !== 'type' &&
      statement['exportKind'] !== 'type' &&
      isNode(statement['source'])
        ? String(statement['source']['value'])
        : undefined;
    if (bareSource !== undefined) {
      if (options.bareAllowed.has(bareSource)) options.seen.add(bareSource);
      else {
        problems.push(
          `${at(statement.start)}: bare side-effect import ${quote(bareSource)} — only the allow-listed stylesheets in Editor.svelte and Flowchart.svelte may be imported for their effect`,
        );
      }
    }
    if (!options.statements) continue;
    if (statement.type === 'ExpressionStatement' && typeof statement['directive'] === 'string')
      continue;
    if (!DECLARATION.has(statement.type)) {
      const reason =
        statement.type === 'ExpressionStatement' &&
        isNode(statement['expression']) &&
        statement['expression'].type === 'AwaitExpression'
          ? 'a top-level `await`'
          : `a top-level ${statement.type}, which runs at load: ${snippet(source, statement)}`;
      problems.push(`${at(statement.start)}: ${reason}`);
      continue;
    }
    if (statement.type === 'VariableDeclaration' && /using/.test(String(statement['kind']))) {
      problems.push(
        `${at(statement.start)}: a top-level \`${String(statement['kind'])}\` declaration, which disposes at load`,
      );
      continue;
    }
    for (const effect of loadTimeEffects(statement, source, topLevel, pure)) {
      problems.push(`${at(effect.offset)}: ${effect.reason}`);
    }
  }
  return problems;
};

/** Every file under `directory`, recursively. */
const filesUnder = (directory: string): Array<string> =>
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name));

/**
 * The `<script>` blocks of a shipped component, each as the component's
 * source with everything outside the block blanked — newlines kept — so
 * offsets and line numbers stay the component's own.
 */
/** `text` with every character but a newline replaced by a space. */
const blank = (text: string): string => text.replace(/[^\n]/g, ' ');

const scriptsOf = (
  file: string,
  source: string,
): Array<{ context: 'default' | 'module'; masked: string }> | Error => {
  let ast: ReturnType<typeof parseSvelte>;
  try {
    ast = parseSvelte(source, { filename: file, modern: true });
  } catch (error) {
    return new Error(`${show(file)}: svelte parse error: ${String(error)}`);
  }
  const scripts: Array<{ context: 'default' | 'module'; masked: string }> = [];
  for (const script of [ast.module, ast.instance]) {
    // The parser leaves an absent block `undefined` at runtime, though typed `null`.
    if (script === null || script === undefined) continue;
    const content: unknown = script.content;
    if (!isNode(content) || typeof content.start !== 'number' || typeof content.end !== 'number') {
      return new Error(`${show(file)}: the svelte parser gave a <script> block no source range`);
    }
    scripts.push({
      context: script.context,
      masked:
        blank(source.slice(0, content.start)) +
        source.slice(content.start, content.end) +
        blank(source.slice(content.end)),
    });
  }
  return scripts;
};

/**
 * Checks every `.js` / `.mjs` / `.svelte` file of every published `dist/`:
 * fails on a bare side-effect import outside `ALLOWED_BARE_IMPORTS`, on a
 * top-level statement that is not a declaration, import or export, and on
 * any load-time effect inside a declaration (`loadTimeEffects`). A `.svelte`
 * file's `<script module>` block runs at load, so gets every rule; its
 * instance `<script>` runs per component, so only its imports are checked.
 */
const sideEffects = (): { files: number; problems: Array<string> } => {
  const problems: Array<string> = [];
  const seen = new Map<string, Set<string>>();
  let files = 0;
  for (const packageDir of PUBLISHED) {
    const dist = distOf(packageDir);
    if (!existsSync(dist)) {
      problems.push(`${packageDir}/dist does not exist — run \`vp run -r build\` first`);
      continue;
    }
    for (const file of filesUnder(dist)
      .filter((path) => PURITY_CHECKED.test(path))
      .toSorted()) {
      files += 1;
      const source = readFileSync(file, 'utf8');
      const bareAllowed = new Set(
        ALLOWED_BARE_IMPORTS.filter((allowed) => resolve(root, allowed.file) === file).map(
          (allowed) => allowed.specifier,
        ),
      );
      const fileSeen = seen.get(show(file)) ?? new Set<string>();
      seen.set(show(file), fileSeen);
      const blocks = file.endsWith('.svelte')
        ? scriptsOf(file, source)
        : [{ context: 'module' as const, masked: source }];
      if (blocks instanceof Error) {
        problems.push(blocks.message);
        continue;
      }
      for (const block of blocks) {
        // A `.svelte` script parses as TypeScript (`lang="ts"` survives svelte-package).
        const parsed = parseSync(file.endsWith('.svelte') ? `${file}.ts` : file, block.masked);
        problems.push(
          ...parsed.errors.map((error) => `${show(file)}: parse error: ${error.message}`),
        );
        problems.push(
          ...programEffects(file, source, parsed, {
            statements: block.context === 'module',
            bareAllowed,
            seen: fileSeen,
          }),
        );
      }
    }
  }
  for (const allowed of ALLOWED_BARE_IMPORTS) {
    if (!seen.get(allowed.file)?.has(allowed.specifier)) {
      problems.push(
        `${allowed.file}: positive control failed — the allow-listed import ${quote(allowed.specifier)} was not seen, so the side-effect check cannot be trusted`,
      );
    }
  }
  return { files, problems };
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

const purity = sideEffects();

if (failures.length > 0) {
  console.error(`check:dist — ${failures.length} entry-point boundary failure(s):\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `check:dist — ${checked} entry-point boundaries hold in dist/ (${CONTROLS.length} positive controls seen)`,
  );
}

if (purity.problems.length > 0) {
  console.error(
    `check:dist — ${purity.problems.length} "sideEffects": false failure(s) in dist/:\n`,
  );
  for (const problem of purity.problems) console.error(`  ✗ ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `check:dist — ${purity.files} dist/ modules are side-effect-free (${ALLOWED_BARE_IMPORTS.length} allow-listed stylesheet imports seen)`,
  );
}
