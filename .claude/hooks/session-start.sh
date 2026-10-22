#!/usr/bin/env bash
#
# Provision a checkout for NON-INTERACTIVE use.
#
# One file, two callers — the Claude Code SessionStart hook and (should this
# repo grow one) a devcontainer's `postCreateCommand`, which invokes this file
# directly — so a container shell and an agent session are provisioned
# identically. The two used to be separate pieces of code in the repos this is
# copied from, and the drift between them stayed invisible until a task failed
# halfway through.
#
# ## The problem it solves
#
# `~/.bashrc` opens with Debian's standard guard:
#
#     case $- in
#         *i*) ;;
#           *) return;;
#     esac
#
# and the line that puts the toolchain on PATH sits *below* it. So the
# environment is correct for a human at a prompt and broken for every
# non-interactive shell, which is what an agent's tool calls and a git hook
# both are. `vp` lives in `node_modules/.bin`, which is on nobody's PATH.
#
# Rather than fight PATH — which this script cannot export into its caller —
# it links the tools into `~/.local/bin`, a directory already on PATH in these
# images and writable by the session user. A symlink survives where an `export`
# cannot.
#
# ## Node, and why this repairs rather than clobbers
#
# `~/.vite-plus/bin/node` is a shim pointing at the `vp` launcher, which
# resolves a Node version and installs it under `~/.vite-plus/js_runtime`. That
# directory can be root-owned from image build while the session user is not,
# so when the resolved version drifts past the cached one the shim fails with a
# permission error. Anything routed through `vp` still works; bare `node` does
# not — which breaks the pre-commit hook repo-wide, because `vp staged` shells
# out to it.
#
# This script therefore *tests* `node --version` and only replaces the shim
# when it is already broken, pointing it at a real cached binary. A working
# shim is left alone, so `vp env use` keeps functioning wherever it functions
# today. The repair is deliberately conditional: unconditionally replacing a
# working shim would trade one breakage for another.
#
# ## Secrets, and the browser
#
# This hook hydrates NO secrets, and the repo holds none: publishing is npm
# OIDC trusted publishing from the release workflow's own identity, so there
# is no token to hydrate — nothing in a session can publish, by construction.
#
# It fetches exactly two things from the network beyond the lockfile's
# dependencies, both for agents rather than for any build: the
# `effect-solutions` CLI and a shallow clone of Effect's source (section 5,
# which runs in the background, pinned to hashes recorded in this file).
#
# It does NOT install a Playwright browser. `vp run -r test:unit` drives
# real Chromium, and the image provides one under /opt/pw-browsers. That build
# is OLDER than the revision the catalog's `playwright` expects (see that entry
# in pnpm-workspace.yaml), so section 4 bridges the two with a directory of
# symlinks rather than downloading anything. Downloading here would be a
# multi-hundred-megabyte fetch on every session start; when no browser is
# present at all, `pnpm exec playwright install chromium` is the one command to
# run, once.
#
# ## Contract
#
# Idempotent, and never fatal. Every failure path logs and continues, because
# the SessionStart hook must not block a session and a half-provisioned
# container is more useful than a container that refused to start. Callers that
# want hard failure should check the tools themselves afterwards.
#
# Untrusted-content note: this script reads only fixed, hardcoded paths. It
# takes no input from repo content, issue or PR bodies, or anything an agent
# could have been persuaded to write earlier in a session — with one narrow
# exception: section 5 reads the catalog's `effect` version from
# pnpm-workspace.yaml and uses it only after matching it against a bare-semver
# pattern. Do not add other such input without revisiting this note — it runs
# on every session start.

set -uo pipefail

log() { printf '[session-start] %s\n' "$1" >&2; }

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LOCAL_BIN="${HOME:-/root}/.local/bin"

mkdir -p "$LOCAL_BIN" 2>/dev/null || log "cannot create $LOCAL_BIN; continuing"

# Link a binary into ~/.local/bin, replacing a stale link but never a real file.
link_tool() {
  src="$1"
  name="$(basename "$src")"
  dest="$LOCAL_BIN/$name"
  [ -x "$src" ] || return 0
  # Leave a real (non-symlink) binary alone: something deliberately installed it.
  if [ -e "$dest" ] && [ ! -L "$dest" ]; then
    return 0
  fi
  ln -sfn "$src" "$dest" 2>/dev/null || log "could not link $name"
}

# `vp` gets a re-exec shim rather than a plain symlink. A symlink always
# resolves to $PROJECT_DIR's node_modules/vite-plus, even when invoked with cwd
# inside a `.claude/worktrees/*` checkout — so the CLI process loads the primary
# tree's vitest while the worktree's test modules resolve the worktree's own
# copy. Two physical instances of the same vitest version corrupt its
# module-level suite-collector state, and every describe() in the worktree
# throws `Cannot read properties of undefined (reading 'config')`. The shim
# instead walks up from $PWD for the nearest project-local vite-plus and
# re-execs that, falling back to the primary checkout's when none is found.
VP_SHIM_MARKER="# generated-by: .claude/hooks/session-start.sh (vp re-exec shim)"
write_vp_shim() {
  dest="$LOCAL_BIN/vp"
  # Leave a real, non-generated file alone: something deliberately installed
  # it. A stale symlink or a shim we generated earlier is fair game to
  # regenerate — the embedded fallback path can change across containers.
  if [ -e "$dest" ] && [ ! -L "$dest" ] \
    && ! grep -qF "$VP_SHIM_MARKER" "$dest" 2>/dev/null; then
    return 0
  fi
  cat >"$dest.tmp" <<SHIM
#!/usr/bin/env bash
$VP_SHIM_MARKER
dir="\$PWD"
while [ -n "\$dir" ]; do
  if [ -x "\$dir/node_modules/vite-plus/bin/vp" ]; then
    exec "\$dir/node_modules/vite-plus/bin/vp" "\$@"
  fi
  [ "\$dir" = "/" ] && break
  dir="\$(dirname "\$dir")"
done
exec "$PROJECT_DIR/node_modules/vite-plus/bin/vp" "\$@"
SHIM
  chmod +x "$dest.tmp" 2>/dev/null && mv -f "$dest.tmp" "$dest" 2>/dev/null \
    || { rm -f "$dest.tmp" 2>/dev/null; log "could not write vp shim"; }
}

# ── 1. Bare `node` ───────────────────────────────────────────────────────────
# Only repair a shim that is already failing — see the header for why this is
# conditional. `command -v node` is not enough: the shim exists and resolves,
# then dies on use, so the version call is the real test.
if ! node --version >/dev/null 2>&1; then
  VP_HOME_DIR="${VP_HOME:-${HOME:-/root}/.vite-plus}"
  # Newest cached runtime wins; `sort -V` so 24.9 does not beat 24.18.
  REAL_NODE="$(
    find "$VP_HOME_DIR/js_runtime/node" \
      -maxdepth 3 -type f -name node -perm -u+x 2>/dev/null | sort -V | tail -1
  )"
  if [ -n "$REAL_NODE" ]; then
    log "bare \`node\` is broken; pointing it at $REAL_NODE"
    # The shim lives in a user-owned directory even though the runtime cache
    # beneath it may be root-owned, so this needs no privileges.
    ln -sfn "$REAL_NODE" "$VP_HOME_DIR/bin/node" 2>/dev/null \
      || link_tool "$REAL_NODE"
  else
    log "bare \`node\` is broken and no cached runtime was found; \`vp\`-routed commands still work"
  fi
fi

# ── 2. Dependencies ──────────────────────────────────────────────────────────
# Unconditional, not only when node_modules is absent: a prebaked container can
# carry a tree built from an OLDER lockfile, and stale dependencies masquerade
# as `trunk` breakage. `--frozen-lockfile` is a sub-second no-op when in sync.
if [ -f "$PROJECT_DIR/pnpm-lock.yaml" ]; then
  log "syncing dependencies against the lockfile…"
  (cd "$PROJECT_DIR" && pnpm install --frozen-lockfile >/dev/null 2>&1) \
    || log "dependency install failed; continuing"
fi

# node_modules/.bin only exists after the install, so link what it provides
# afterwards.
write_vp_shim

# ── 3. First-checkout codegen ────────────────────────────────────────────────
# `svelte-kit sync` writes the package's ambient types under `.svelte-kit/`.
# Without it, `svelte-check` and `svelte-package` both fail on a fresh checkout
# or worktree with errors that name a missing generated file rather than the
# missing codegen step. Cheap and idempotent, so it runs unconditionally.
if [ -d "$PROJECT_DIR/node_modules" ]; then
  log "running svelte-kit sync…"
  (cd "$PROJECT_DIR" && "$LOCAL_BIN/vp" run --filter ./packages/prosekit-svelte --filter ./packages/prosekit-flowchart sync >/dev/null 2>&1) \
    || log "codegen failed; run \`vp run -r sync\` by hand"
fi

# ── 4. Playwright browser bridge ─────────────────────────────────────────────
# The catalog pins `playwright` 1.60.0, which looks for Chromium revision 1223;
# the image ships revision 1194 under /opt/pw-browsers. Playwright finds a
# browser purely by path — <PLAYWRIGHT_BROWSERS_PATH>/<name>-<revision>/<the
# per-platform layout in playwright-core's EXECUTABLE_PATHS> — so a directory
# of symlinks carrying 1223's names but pointing at the 1194 build is enough
# for `vp run -r test:unit` to launch it. Both layouts are linked: x64 CfT
# names (`chrome-linux64/chrome`, `chrome-headless-shell-linux64/
# chrome-headless-shell`) and the arm64 ones (`chrome-linux/…`). Headless runs
# use the headless shell, so that is the one the suites actually launch.
#
# /opt/pw-browsers is read, never written. The bridge only applies while the
# image still lacks 1223; once the image carries it, this section is a no-op
# and should be deleted along with the bump comment in the catalog. Bump
# PW_WANT_REV together with the catalog's `playwright` entry.
#
# The variable reaches the agent's shells through $CLAUDE_ENV_FILE, which
# Claude Code sources before each Bash command — the one way a SessionStart
# hook can export into its caller. Without it (a devcontainer invoking this
# file directly), the export line is logged for the caller to apply.
PW_IMAGE_DIR="/opt/pw-browsers"
PW_HAVE_REV="1194"
PW_WANT_REV="1223"
PW_BRIDGE_DIR="${HOME:-/root}/.cache/prosekit-pw-browsers"
PW_FULL="$PW_IMAGE_DIR/chromium-$PW_HAVE_REV/chrome-linux"
PW_SHELL="$PW_IMAGE_DIR/chromium_headless_shell-$PW_HAVE_REV/chrome-linux"
if [ -d "$PW_IMAGE_DIR/chromium-$PW_WANT_REV" ] \
  && [ -d "$PW_IMAGE_DIR/chromium_headless_shell-$PW_WANT_REV" ]; then
  : # The image already carries the wanted revision; nothing to bridge.
elif [ -x "$PW_FULL/chrome" ] && [ -x "$PW_SHELL/headless_shell" ]; then
  log "bridging Chromium $PW_HAVE_REV as $PW_WANT_REV under $PW_BRIDGE_DIR…"
  full="$PW_BRIDGE_DIR/chromium-$PW_WANT_REV"
  shell="$PW_BRIDGE_DIR/chromium_headless_shell-$PW_WANT_REV"
  if mkdir -p "$full" "$shell/chrome-headless-shell-linux64" 2>/dev/null; then
    ln -sfn "$PW_FULL" "$full/chrome-linux64" 2>/dev/null \
      || log "could not link $full/chrome-linux64"
    ln -sfn "$PW_FULL" "$full/chrome-linux" 2>/dev/null \
      || log "could not link $full/chrome-linux"
    ln -sfn "$PW_SHELL" "$shell/chrome-linux" 2>/dev/null \
      || log "could not link $shell/chrome-linux"
    # The image's `headless_shell` is a wrapper that execs the absolute path
    # of `headless_shell.real`, so a symlink under the CfT name resolves its
    # resources from the 1194 directory.
    ln -sfn "$PW_SHELL/headless_shell" \
      "$shell/chrome-headless-shell-linux64/chrome-headless-shell" 2>/dev/null \
      || log "could not link the headless shell under $shell"
    # ffmpeg's revision is unchanged between the two releases.
    for other in "$PW_IMAGE_DIR"/ffmpeg-*; do
      if [ -d "$other" ]; then
        ln -sfn "$other" "$PW_BRIDGE_DIR/$(basename "$other")" 2>/dev/null \
          || log "could not link $(basename "$other")"
      fi
    done
    touch "$full/INSTALLATION_COMPLETE" "$full/DEPENDENCIES_VALIDATED" \
      "$shell/INSTALLATION_COMPLETE" "$shell/DEPENDENCIES_VALIDATED" 2>/dev/null \
      || log "could not mark the bridged revision installed"
    pw_export="$(printf 'export PLAYWRIGHT_BROWSERS_PATH=%q' "$PW_BRIDGE_DIR")"
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      # A `resume` re-runs this hook against the same env file; append once.
      # The braces put the redirection's own failure under `2>/dev/null` too,
      # so an unwritable env file logs the line below rather than bash's error.
      grep -qxF "$pw_export" "$CLAUDE_ENV_FILE" 2>/dev/null \
        || { printf '%s\n' "$pw_export" >>"$CLAUDE_ENV_FILE"; } 2>/dev/null \
        || log "could not write \$CLAUDE_ENV_FILE; $pw_export by hand"
    else
      log "export PLAYWRIGHT_BROWSERS_PATH=$PW_BRIDGE_DIR to use the bridged browser"
    fi
  else
    log "could not create $PW_BRIDGE_DIR; the browser suites will not find Chromium $PW_WANT_REV"
  fi
else
  log "no Chromium $PW_HAVE_REV under $PW_IMAGE_DIR to bridge; run \`pnpm exec playwright install chromium\` once"
fi

# ── 5. effect-solutions, and the Effect source for reference ─────────────────
# AGENTS.md § Effect sends agents to `effect-solutions` (Kit Langton's CLI of
# Effect best-practice docs: `effect-solutions list`, `… show <topic>`) and to
# a local clone of Effect's source, the setup that CLI's own quick-start
# prescribes. Neither belongs in the catalog: they are agent tooling, not
# anything a package here builds or tests against.
#
# It runs IN THE BACKGROUND, so the hook returns at once: a cold fetch is
# ~118 MB plus a clone, and against a stalled proxy its bounded steps would
# overrun the SessionStart timeout. On a cold container the CLI therefore
# appears on PATH a little after the session starts; progress and failures go
# to $ES_LOG (~/.cache/effect-solutions/provision.log), whose path the hook
# logs. One job runs at a time per HOME: the hook claims $ES_LOCK in the
# FOREGROUND (flock, or a lock directory where flock is missing), starts a
# fresh $ES_LOG, and only then forks the job, which inherits the lock. A
# session that finds the lock held leaves the work, and the log, to the
# holder. Under the lock, the job first sweeps `*.tmp.*` work dirs older than
# an hour (left by a job that was killed), and an EXIT trap removes its own.
# The job runs in its own process group (`set -m`), so a runner that kills the
# hook's group once the hook returns does not take the job with it.
#
# The CLI. The npm package ships a `#!/usr/bin/env bun` launcher plus one
# prebuilt, self-contained binary per platform; the launcher only picks the
# binary and spawns it. So rather than `npm install -g` it (which would also
# install the package's Effect-beta dependencies and need `bun` on PATH), this
# fetches the tarball with `npm pack`, checks it against ES_INTEGRITY — pinned
# HERE, not taken from the registry or proxy that serves the tarball — keeps
# just this platform's binary under a per-version cache dir, checks that
# against its pinned sha256, and links it onto ~/.local/bin. Any mismatch logs
# and skips; the binary is never installed, linked or run (it may have been
# extracted into the private temp dir, which the job then deletes). The cached binary is re-hashed on every
# session start, so a tampered cache is discarded and fetched again.
#
# ES_VERSION is pinned EXACT and must be at least a day old on npm, matching
# the workspace's `minimumReleaseAge` hold. To bump it:
#   1. `npm view effect-solutions time --json`; pick a release older than 24h.
#   2. `npm view effect-solutions@<ver> bin` still names `effect-solutions`.
#   3. `npm pack effect-solutions@<ver>` in a scratch dir; ES_INTEGRITY is
#      `sha512-$(openssl dgst -sha512 -binary <tgz> | openssl base64 -A)`,
#      which must equal `npm view effect-solutions@<ver> dist.integrity`.
#   4. `tar -xzf <tgz> package/dist` and `sha256sum
#      package/dist/effect-solutions-*`: one ES_SHA256_* per platform below.
#
# The source. A shallow clone of Effect at the tag matching the catalog's
# `effect` entry, under ~/.local/share/effect-solutions/effect@<version>, with
# `…/effect` a symlink to it — the path the CLI's docs name. Effect 4's
# releases are tagged `effect@<version>` in Effect-TS/effect (the `repository`
# of the published package); the CLI's docs name the pre-release effect-smol
# repository, which carries only the betas. A tag can be moved, so the clone's
# HEAD must equal the commit pinned for that version in `effect_commit_for`;
# a catalog version with no pinned commit is not cloned at all. BUMP THAT MAP
# WITH THE CATALOG'S `effect` ENTRY: `git ls-remote
# https://github.com/Effect-TS/effect 'refs/tags/effect@<ver>'
# 'refs/tags/effect@<ver>^{}'` gives the commit — the `^{}` line's, if the tag
# is annotated. Name the refs exactly: a glob would also match a pre-release
# tag such as `effect@<ver>-beta.1`. A clone is renamed into
# place only once complete and verified, so its directory existing means it is
# usable. A real (non-symlink) `…/effect` directory is left alone: someone put
# it there.
#
# Earlier pins. Both caches are keyed by version, so a bump fetches the new
# copy beside the old one (~98 MB a binary, ~58 MB a clone). Under the lock,
# and only once the CURRENT version is in place, verified and linked, the job
# removes the other version directories: `$ES_ROOT/<ver>` and
# `$ES_SHARE/effect@<ver>`, real directories whose names are bare semvers
# (es_prune_dir holds every guard). A failed or offline fetch therefore never
# deletes the last working copy, and nothing else in those directories — the
# lock, the log, the `effect` link, a real `…/effect` directory, `*.tmp.*` work
# dirs (the age sweep's), anything a person put there — is touched. Each
# removal is logged to $ES_LOG. Sessions sharing one $HOME but pinning
# different versions (two branches in one container) each prune the other's
# copy and refetch it on their next start; that costs bandwidth, not
# correctness.
#
# Offline, both steps log and the job ends; the session never waits on it.
ES_VERSION="0.5.3"
ES_INTEGRITY="sha512-JIG7XV0gJF5eVV+9un5Yp7MEFMGNfuTYxbiV/HzS80zH/9qx9ZOoXd6Mlw0FXdbC41LGcpWYZJG3MnzxYawEWg=="
ES_SHA256_LINUX_X64="3d7ba2c0ecf9bc443944bc4efdbbea385e4701134bab016959f6807348006877"
ES_SHA256_LINUX_ARM64="00102ca9d820522aad8fe3caf702eb00a1eae39474a19da26c8dcec848b17dee"
ES_SHA256_DARWIN_X64="b9c1b0c92306b894a3ffd588df94bee95e86fb8c13445530f3b5c35e14f6d386"
ES_SHA256_DARWIN_ARM64="112871924741ee08f44b97bfadc2b011eeee4bc6f70c6eab8ad60566d1d08c64"
ES_ROOT="${HOME:-/root}/.cache/effect-solutions"
ES_CACHE="$ES_ROOT/$ES_VERSION"
ES_BIN="$ES_CACHE/effect-solutions"
ES_LOCK="$ES_ROOT/.lock"
ES_LOG="$ES_ROOT/provision.log"
ES_SHARE="${HOME:-/root}/.local/share/effect-solutions"
EFFECT_REPO_URL="https://github.com/Effect-TS/effect.git"
NET_TIMEOUT="300"

# The commit each catalog `effect` version's tag must resolve to.
effect_commit_for() {
  case "$1" in
    4.0.0) printf '%s' "67ba4e46a11ccda0b6761578bfd22c04ae00167d" ;;
    4.0.1) printf '%s' "460272d30457f4697d8b8c52cad41caccbcace08" ;;
    4.0.2) printf '%s' "269a7c864351231d42e6e95b7fa8f32050df3691" ;;
    *) return 1 ;;
  esac
}

# `timeout` when coreutils has it; otherwise run the command unbounded. macOS
# ships no `timeout`, so there a stalled fetch or clone can hang indefinitely;
# the job is in the background, so the session never waits on it, and the
# stale-lock rule below (a lock older than an hour is reclaimed) is the
# backstop that lets a later session start a fresh job.
bounded() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "$NET_TIMEOUT" "$@"
  else
    "$@"
  fi
}

# Digest of a file: `digest_of sha256 <file>` prints lowercase hex, `digest_of
# sha512 <file>` prints base64 (the npm `integrity` encoding). openssl when it
# is present; node, which this repo always has, otherwise.
digest_of() {
  if command -v openssl >/dev/null 2>&1; then
    if [ "$1" = sha512 ]; then
      openssl dgst -sha512 -binary "$2" | openssl base64 -A
    else
      openssl dgst -sha256 -r "$2" | cut -d' ' -f1
    fi
  else
    node -e 'const c = require("crypto"), f = require("fs");
      process.stdout.write(c.createHash(process.argv[1])
        .update(f.readFileSync(process.argv[2]))
        .digest(process.argv[1] === "sha512" ? "base64" : "hex"))' "$1" "$2"
  fi
}

# Is $1 the name of one of this section's version directories? A bare semver,
# the same pattern the catalog version must match, and never a work dir: a
# pre-release pin's `<ver>.tmp.XXXXXX` would otherwise match too, and work dirs
# belong to the age sweep in provision_effect.
es_is_version() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] && [[ "$1" != *.tmp.* ]]
}

# Remove $1/$2, a version directory an earlier pin left behind, and nothing
# else. Every guard must hold: the parent is $ES_ROOT (names `<ver>`) or
# $ES_SHARE (names `effect@<ver>`), as a non-empty absolute path ending in the
# expected suffix, and is not itself a symlink (a cache dir pointed elsewhere
# is never pruned through); the name has no slash and its version passes
# es_is_version; and the target is a real directory, not a symlink. So an
# unset variable, the lock, the log, the `effect` link or anything else that
# lands here is skipped, never removed.
es_prune_dir() {
  local parent="$1" name="$2" ver dir
  case "$name" in
    "" | */*) return 0 ;;
  esac
  if [ -n "$ES_ROOT" ] && [ "$parent" = "$ES_ROOT" ]; then
    case "$parent" in /?*/.cache/effect-solutions) ;; *) return 0 ;; esac
    ver="$name"
  elif [ -n "$ES_SHARE" ] && [ "$parent" = "$ES_SHARE" ]; then
    case "$parent" in /?*/.local/share/effect-solutions) ;; *) return 0 ;; esac
    case "$name" in effect@?*) ver="${name#effect@}" ;; *) return 0 ;; esac
  else
    return 0
  fi
  [ ! -L "$parent" ] || return 0
  es_is_version "$ver" || return 0
  dir="$parent/$name"
  [ -d "$dir" ] && [ ! -L "$dir" ] || return 0
  if rm -rf -- "$dir" 2>/dev/null; then
    log "removed $dir, left by an earlier pin"
  else
    log "could not remove $dir; continuing"
  fi
}

case "$(uname -s 2>/dev/null)-$(uname -m 2>/dev/null)" in
  Linux-x86_64) es_target="linux-x64" es_sha256="$ES_SHA256_LINUX_X64" ;;
  Linux-aarch64 | Linux-arm64) es_target="linux-arm64" es_sha256="$ES_SHA256_LINUX_ARM64" ;;
  Darwin-x86_64) es_target="darwin-x64" es_sha256="$ES_SHA256_DARWIN_X64" ;;
  Darwin-arm64) es_target="darwin-arm64" es_sha256="$ES_SHA256_DARWIN_ARM64" ;;
  *) es_target="" es_sha256="" ;;
esac

# The CLI: verify a cached binary, else fetch, verify and cache one; then link.
provision_effect_solutions() {
  if [ -z "$es_target" ]; then
    log "effect-solutions ships no binary for $(uname -sm 2>/dev/null); skipping it"
    return 0
  fi
  if [ -e "$ES_BIN" ] && [ "$(digest_of sha256 "$ES_BIN" 2>/dev/null)" != "$es_sha256" ]; then
    log "cached $ES_BIN does not match its pinned sha256; discarding it"
    rm -f "$ES_BIN" 2>/dev/null
    if [ "$(readlink "$LOCAL_BIN/effect-solutions" 2>/dev/null)" = "$ES_BIN" ]; then
      rm -f "$LOCAL_BIN/effect-solutions" 2>/dev/null
    fi
  fi
  if [ -x "$ES_BIN" ]; then
    : # Already fetched and verified at this version.
  elif ! command -v npm >/dev/null 2>&1; then
    log "no npm on PATH; cannot fetch effect-solutions $ES_VERSION"
  else
    log "fetching effect-solutions $ES_VERSION…"
    local tgz bin
    if mkdir -p "$ES_CACHE" 2>/dev/null \
      && es_tmp="$(mktemp -d "$ES_CACHE.tmp.XXXXXX" 2>/dev/null)"; then
      tgz="$es_tmp/effect-solutions-$ES_VERSION.tgz"
      bin="$es_tmp/package/dist/effect-solutions-$es_target"
      # A throwaway npm cache: the tarball is not worth keeping a second copy of.
      if ! (cd "$es_tmp" && bounded npm pack --silent --fetch-retries=1 \
        --cache "$es_tmp/npm-cache" "effect-solutions@$ES_VERSION" >/dev/null 2>&1); then
        log "could not fetch effect-solutions $ES_VERSION (offline?); continuing without it"
      elif [ "sha512-$(digest_of sha512 "$tgz" 2>/dev/null)" != "$ES_INTEGRITY" ]; then
        log "effect-solutions-$ES_VERSION.tgz does not match the pinned ES_INTEGRITY; NOT installing it"
      elif ! tar -xzf "$tgz" -C "$es_tmp" "package/dist/effect-solutions-$es_target" 2>/dev/null; then
        log "effect-solutions-$ES_VERSION.tgz has no $es_target binary; continuing without it"
      elif [ "$(digest_of sha256 "$bin" 2>/dev/null)" != "$es_sha256" ]; then
        log "the effect-solutions $es_target binary does not match its pinned sha256; NOT installing it"
      elif chmod +x "$bin" 2>/dev/null && mv -f "$bin" "$ES_BIN" 2>/dev/null; then
        log "installed effect-solutions $ES_VERSION at $ES_BIN"
      else
        log "could not install effect-solutions into $ES_CACHE; continuing without it"
      fi
    else
      log "could not create $ES_CACHE; continuing without effect-solutions"
    fi
    if [ -n "${es_tmp:-}" ]; then rm -rf "$es_tmp" 2>/dev/null; fi
    es_tmp=""
  fi
  # Point the PATH entry at this version, even when the binary was already
  # cached: a container carried over from an older pin keeps a stale link.
  if [ -x "$ES_BIN" ]; then
    local dest="$LOCAL_BIN/effect-solutions"
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      : # A real file: something deliberately installed it. Leave it alone.
    elif [ "$(readlink "$dest" 2>/dev/null)" != "$ES_BIN" ]; then
      ln -sfn "$ES_BIN" "$dest" 2>/dev/null || log "could not link effect-solutions"
    fi
    # Only now, with this version's binary cached and verified (re-hashed
    # above, or hash-checked before it was moved in), drop the binaries of
    # earlier pins, but only when the PATH entry is absent or already points
    # at this version's binary: if the relink failed, nothing is pruned, so the
    # entry is never left dangling (compared with $ES_BIN, not re-spelled).
    local entry name
    if [ ! -L "$dest" ] || [ "$(readlink "$dest" 2>/dev/null)" = "$ES_BIN" ]; then
      for entry in "$ES_ROOT"/*; do
        name="${entry##*/}"
        [ "$name" != "$ES_VERSION" ] || continue
        es_prune_dir "$ES_ROOT" "$name"
      done
    fi
  fi
}

# The source: clone the catalog's `effect` tag, verify its commit, then link.
provision_effect_source() {
  local effect_version effect_commit effect_src effect_link got
  # The catalog's `effect` version, read from pnpm-workspace.yaml and accepted
  # only as a bare semver, since it becomes part of a git ref and a path.
  effect_version="$(
    sed -n 's/^  effect: \([0-9][0-9A-Za-z.+-]*\)$/\1/p' \
      "$PROJECT_DIR/pnpm-workspace.yaml" 2>/dev/null | head -1
  )"
  if ! [[ "$effect_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
    log "no exact \`effect\` version in the catalog; skipping the Effect source clone"
    return 0
  fi
  if ! effect_commit="$(effect_commit_for "$effect_version")"; then
    log "no pinned commit for Effect $effect_version in effect_commit_for; skipping the Effect source clone"
    return 0
  fi
  effect_src="$ES_SHARE/effect@$effect_version"
  if [ ! -d "$effect_src" ]; then
    log "cloning Effect $effect_version for reference…"
    if mkdir -p "$ES_SHARE" 2>/dev/null \
      && effect_tmp="$(mktemp -d "$effect_src.tmp.XXXXXX" 2>/dev/null)"; then
      if ! GIT_TERMINAL_PROMPT=0 bounded git -c advice.detachedHead=false clone \
        --quiet --depth 1 --single-branch --no-tags \
        --branch "effect@$effect_version" "$EFFECT_REPO_URL" "$effect_tmp/effect" \
        >/dev/null 2>&1; then
        log "could not clone Effect $effect_version (offline?); continuing without it"
      elif ! got="$(git -C "$effect_tmp/effect" rev-parse HEAD 2>/dev/null)" \
        || [ "$got" != "$effect_commit" ]; then
        log "tag effect@$effect_version is at ${got:-?}, not the pinned $effect_commit; NOT keeping the clone"
      elif [ -d "$effect_src" ] || mv -T "$effect_tmp/effect" "$effect_src" 2>/dev/null; then
        log "cloned Effect $effect_version to $effect_src"
      else
        log "could not move the Effect clone into $effect_src; continuing without it"
      fi
      rm -rf "$effect_tmp" 2>/dev/null
      effect_tmp=""
    else
      log "could not create $ES_SHARE; skipping the Effect source clone"
    fi
  elif [ "$(git -C "$effect_src" rev-parse HEAD 2>/dev/null)" != "$effect_commit" ]; then
    log "$effect_src is not at the pinned $effect_commit; not linking it"
    return 0
  fi
  effect_link="$ES_SHARE/effect"
  if [ -d "$effect_src" ]; then
    if [ -e "$effect_link" ] && [ ! -L "$effect_link" ]; then
      log "leaving the existing $effect_link alone; Effect $effect_version is at $effect_src"
    elif [ "$(readlink "$effect_link" 2>/dev/null)" != "effect@$effect_version" ]; then
      ln -sfn "effect@$effect_version" "$effect_link" 2>/dev/null \
        || log "could not link $effect_link"
    fi
  fi
  # Only once this version's clone is in place, at its pinned commit, and
  # linked, drop the clones of earlier pins. A real `…/effect` directory or a
  # failed relink means the current clone is not what agents read, so nothing
  # is removed. `effect` itself never matches `effect@<semver>`.
  if [ -d "$effect_src" ] && [ -L "$effect_link" ] \
    && [ "$(readlink "$effect_link" 2>/dev/null)" = "effect@$effect_version" ] \
    && [ "$(git -C "$effect_src" rev-parse HEAD 2>/dev/null)" = "$effect_commit" ]; then
    local entry name
    for entry in "$ES_SHARE"/effect@*; do
      name="${entry##*/}"
      [ "$name" != "effect@$effect_version" ] || continue
      es_prune_dir "$ES_SHARE" "$name"
    done
  fi
}

# The job: lock, sweep, provision. Run only in the background, below.
provision_effect() {
  es_tmp=""
  effect_tmp=""
  # es_lockdir is set only under the mkdir lock, which this releases too.
  trap 'rm -rf "${es_tmp:-}" "${effect_tmp:-}" 2>/dev/null
    [ -z "${es_lockdir:-}" ] || rmdir "$es_lockdir" 2>/dev/null' EXIT
  # A killed job leaves its work dirs behind; nothing live is an hour old.
  find "$ES_ROOT" "$ES_SHARE" -maxdepth 1 -name '*.tmp.*' -mmin +60 \
    -exec rm -rf {} + 2>/dev/null
  provision_effect_solutions
  provision_effect_source
  log "done"
}

# Start this session's log, only once the lock is ours: truncating before the
# claim would wipe a running job's log whenever another session holds it. The
# `started` line means a log ending in `done` is never one left over from an
# earlier session, and a session that finds the lock held leaves that job's
# log untouched.
es_start_log() {
  { printf 'started %s (pid %s)\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$$" >"$ES_LOG"; } 2>/dev/null \
    || log "could not write $ES_LOG; the background job logs nowhere"
  log "provisioning effect-solutions in the background; progress in $ES_LOG"
}

# `set -m` gives each `&` job its own process group, so a runner that kills the
# hook's process group once the hook returns cannot kill the job too. Pure
# bash, so it works on macOS as well; it is switched back off once forked.
set -m
if ! mkdir -p "$ES_ROOT" 2>/dev/null; then
  log "could not create $ES_ROOT; skipping effect-solutions"
elif command -v flock >/dev/null 2>&1; then
  # The lock fd is opened and locked HERE, then inherited by the job; the
  # hook's own copy is closed once the job is forked, so the lock lasts
  # exactly as long as the job (and anything it spawned) holds the fd.
  if { exec 9>"$ES_LOCK"; } 2>/dev/null && flock -n 9; then
    es_start_log
    (
      trap '' HUP
      exec >>"$ES_LOG" 2>&1
      provision_effect
    ) </dev/null >/dev/null 2>&1 &
  else
    log "effect-solutions is already being provisioned by another session; progress in $ES_LOG"
  fi
  exec 9>&- 2>/dev/null
else
  # No flock (macOS): an atomic mkdir is the lock, released by the job's EXIT
  # trap. A lock older than an hour outlived a killed job; nothing live holds
  # it that long. A stale lock is claimed by renaming it away first: of two
  # sessions that both find it stale, only the one whose `mv` wins removes it
  # and retries the mkdir, so they cannot both delete and both re-create it.
  es_have_lock=""
  if mkdir "$ES_LOCK.d" 2>/dev/null; then
    es_have_lock=1
  elif [ -n "$(find "$ES_LOCK.d" -maxdepth 0 -mmin +60 2>/dev/null)" ] \
    && mv "$ES_LOCK.d" "$ES_LOCK.d.stale.$$" 2>/dev/null; then
    rmdir "$ES_LOCK.d.stale.$$" 2>/dev/null
    if mkdir "$ES_LOCK.d" 2>/dev/null; then es_have_lock=1; fi
  fi
  if [ -n "$es_have_lock" ]; then
    es_start_log
    (
      es_lockdir="$ES_LOCK.d"
      trap '' HUP
      exec >>"$ES_LOG" 2>&1
      provision_effect
    ) </dev/null >/dev/null 2>&1 &
  else
    log "effect-solutions is already being provisioned by another session; progress in $ES_LOG"
  fi
fi
set +m

exit 0
