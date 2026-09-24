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
# It also does NOT install a Playwright browser. `vp run -r test:unit` drives
# real Chromium, and the image is expected to provide one under
# `PLAYWRIGHT_BROWSERS_PATH` matching the `playwright` version the catalog pins
# (see that entry in pnpm-workspace.yaml). Downloading one here would be a
# multi-hundred-megabyte fetch on every session start; when the browser is
# genuinely missing, `pnpm exec playwright install chromium` is the one command
# to run, once.
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
# could have been persuaded to write earlier in a session. Do not add such
# input without revisiting this note — it runs on every session start.

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
# as trunk breakage. `--frozen-lockfile` is a sub-second no-op when in sync.
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

exit 0
