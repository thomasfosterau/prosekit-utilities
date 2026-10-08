/**
 * Enforces the entry-point import boundaries against the BUILT `dist/` —
 * the files a consumer actually loads — rather than against `src/`.
 *
 * For each guarded entry point it resolves every file the package's `exports`
 * maps the entry to, under every condition but `types` (`import`, `node`,
 * `browser`, `svelte`, `default`, …), then walks the emitted module graph
 * from each: every static import, re-export and dynamic `import()` of a
 * relative `.js` / `.mjs` / `.cjs` file is followed into the shared chunks it
 * reaches, and every specifier on the way — bare or relative — is checked
 * against the entry's forbidden list. Specifiers are read with the oxc parser
 * Vite+ ships, so a comment or string that merely mentions a package never
 * counts, and a type-only import never survives into `.js`.
 *
 * It is fail-closed: it fails — never skips — when a built entry is missing,
 * when a dynamic `import()` has no literal specifier, when a relative import
 * names a file it cannot open as a JavaScript module (extensionless, `.json`,
 * anything but the `.svelte` and `.css` leaves) or that does not exist, and
 * when a positive control cannot see the import it must see (so the walk can
 * never pass vacuously).
 *
 * Run it after the build: `vp run check:dist` (the root task depends on every
 * package's `build`). The boundaries themselves are documented in each
 * package's CLAUDE.md § Boundary.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
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
 * workspace depends on, any compiled `.svelte` module, and this package's own
 * canvas root (or any subpath but `./node`) reached by name.
 */
const SVELTE_OR_XYFLOW =
  /^(?:svelte(?:\/|$)|@xyflow\/|bits-ui(?:\/|$)|@thomasfosterau\/prosekit-svelte(?:\/|$)|@thomasfosterau\/prosekit-flowchart(?:$|\/(?!node$)))|\.svelte(?:\.js)?$/;

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

/** Every file an `exports` entry resolves to at runtime, deduplicated, or an error message. */
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
  const missing = files.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    return new Error(
      `${missing.map(show).join(', ')} (exports["${entry}"] of ${packageDir}) does not exist — run \`vp run -r build\` first`,
    );
  }
  return files;
};

/** A relative module the walk opens and follows. */
const WALKED = /\.[cm]?js$/;

/** A relative module the walk checks by name only: a compiled component or a stylesheet. */
const LEAF = /\.(?:svelte|css)$/;

/** Every module specifier one emitted file requests, in source order. */
const specifiersOf = (file: string): { specifiers: Array<string>; problems: Array<string> } => {
  const source = readFileSync(file, 'utf8');
  const { module, errors } = parseSync(file, source);
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
  return { specifiers, problems };
};

/**
 * Walks the relative-import graph from `entryFiles`, collecting every
 * specifier it requests. A relative specifier is collected too (so a
 * `.svelte` module is caught by name) and, unless it is a `.svelte` or `.css`
 * leaf, must be a `.js` / `.mjs` / `.cjs` file that exists, or the walk
 * reports that the boundary cannot be proven.
 */
const walk = (entryFiles: ReadonlyArray<string>): Walk => {
  const reached: Array<Reached> = [];
  const problems: Array<string> = [];
  const seen = new Set<string>();
  const queue: Array<{ file: string; chain: ReadonlyArray<string> }> = entryFiles.map((file) => ({
    file,
    chain: [show(file)],
  }));
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (seen.has(next.file)) continue;
    seen.add(next.file);
    const parsed = specifiersOf(next.file);
    problems.push(...parsed.problems);
    for (const specifier of new Set(parsed.specifiers)) {
      reached.push({ specifier, chain: next.chain });
      if (!specifier.startsWith('.')) continue;
      const target = resolve(dirname(next.file), specifier);
      if (LEAF.test(target)) continue;
      if (!WALKED.test(target)) {
        problems.push(
          `${show(next.file)}: imports "${specifier}": not a resolvable .js module, so the boundary cannot be proven`,
        );
        continue;
      }
      if (!existsSync(target)) {
        problems.push(`${show(next.file)}: imports ${specifier}, which does not exist`);
        continue;
      }
      queue.push({ file: target, chain: [...next.chain, show(target)] });
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
  const result = walk(entryFiles);
  failures.push(...result.problems.map((problem) => `${label}: ${problem}`));
  for (const { specifier, chain } of result.reached) {
    if (boundary.forbidden.test(specifier)) {
      failures.push(
        `${label} reaches forbidden import "${specifier}" via ${chain.join(' -> ')}\n    (${boundary.reason})`,
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
  const result = walk(entryFiles);
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
