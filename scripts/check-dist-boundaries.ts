/**
 * Enforces the entry-point import boundaries against the BUILT `dist/` —
 * the files a consumer actually loads — rather than against `src/`.
 *
 * For each guarded entry point it resolves the entry's `default` file from
 * the package's `exports`, then walks the emitted module graph: every static
 * import, re-export and dynamic `import()` of a relative file is followed
 * into the shared chunks it reaches, and every bare specifier on the way is
 * checked against the entry's forbidden list. Specifiers are read with the
 * oxc parser Vite+ ships, so a comment or string that merely mentions a
 * package never counts, and a type-only import never survives into `.js`.
 *
 * It fails — never skips — when a built entry is missing, when a dynamic
 * `import()` has no literal specifier (the boundary cannot be proven), and
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

/** `prosekit`, any `prosekit/*` subpath, and any `@prosekit/*` package. */
const PROSEKIT = /^(?:prosekit(?:\/|$)|@prosekit\/)/;

/**
 * Svelte itself, the xyflow engine, the Svelte component packages this
 * workspace depends on, and any compiled `.svelte` module.
 */
const SVELTE_OR_XYFLOW =
  /^(?:svelte(?:\/|$)|@xyflow\/|bits-ui(?:\/|$)|@thomasfosterau\/prosekit-svelte(?:\/|$))|\.svelte(?:\.js)?$/;

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

/** The `default` file of an `exports` entry, or an error message. */
const resolveEntry = (packageDir: string, entry: string): string | Error => {
  const manifestPath = resolve(root, packageDir, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    exports?: Record<string, { default?: string } | undefined>;
  };
  const target = manifest.exports?.[entry]?.default;
  if (target === undefined) {
    return new Error(`${show(manifestPath)} has no exports["${entry}"].default`);
  }
  const file = resolve(root, packageDir, target);
  if (!existsSync(file)) {
    return new Error(
      `${show(file)} (exports["${entry}"] of ${packageDir}) does not exist — run \`vp run -r build\` first`,
    );
  }
  return file;
};

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

/** Walks the relative-import graph from `entryFile`, collecting every bare specifier. */
const walk = (entryFile: string): Walk => {
  const reached: Array<Reached> = [];
  const problems: Array<string> = [];
  const seen = new Set<string>();
  const queue: Array<{ file: string; chain: ReadonlyArray<string> }> = [
    { file: entryFile, chain: [show(entryFile)] },
  ];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (seen.has(next.file)) continue;
    seen.add(next.file);
    const parsed = specifiersOf(next.file);
    problems.push(...parsed.problems);
    for (const specifier of parsed.specifiers) {
      if (!specifier.startsWith('.')) {
        reached.push({ specifier, chain: next.chain });
        continue;
      }
      const target = resolve(dirname(next.file), specifier);
      // A relative `.svelte` (or any non-JS) module is a leaf, checked by name.
      if (!target.endsWith('.js')) {
        reached.push({ specifier, chain: next.chain });
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
  const entryFile = resolveEntry(boundary.packageDir, boundary.entry);
  if (entryFile instanceof Error) {
    failures.push(`${label}: ${entryFile.message}`);
    continue;
  }
  const result = walk(entryFile);
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
  const entryFile = resolveEntry(control.packageDir, control.entry);
  if (entryFile instanceof Error) {
    failures.push(`${label}: ${entryFile.message}`);
    continue;
  }
  const result = walk(entryFile);
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
