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
# ## Vite+ first
#
# `~/.bashrc` opens with Debian's interactive-only guard, and the line that
# puts the toolchain on PATH sits below it, so a non-interactive shell (an
# agent's tool call, a git hook) finds no toolchain. This script cannot export
# into its caller, so it writes into `~/.local/bin`, a directory already on
# PATH in these images and writable by the session user.
#
# Vite+ (`vp`) is the one tool it guarantees; everything else is reached
# through it. The global CLI is installed at exactly the `vite-plus` version
# pinned in `pnpm-workspace.yaml`'s catalog, using the official installer,
# which takes the release from the npm registry, refuses a package without
# npm provenance and checks its SHA-512 `dist.integrity`. It installs under
# `~/.local/share/vite-plus` and touches no shell profile, so `vp` and `vpx`
# are then linked into `~/.local/bin` (symlinks to the real binaries).
#
# From there:
#
# - `vp install --frozen-lockfile` installs the dependencies.
# - The global `vp` delegates development commands to the project-local
#   `vite-plus`, including inside `.claude/worktrees/*`, so each checkout runs
#   its own pinned toolchain without a shim (and a worktree loads its own
#   vitest, not the primary checkout's: two physical copies of one vitest
#   corrupt its suite-collector state, and every `describe()` throws
#   `Cannot read properties of undefined (reading 'config')`).
# - Project tools run through Vite+: `vp exec fallow …` for fallow (the commit
#   gate does the same). Nothing else is put on PATH: no shim walks a
#   directory tree, and nothing runs a `node_modules/.bin` the session did not
#   install.
#
# Earlier versions of this hook wrote a walking `vp` re-exec shim and a
# `fallow` re-exec shim into `~/.local/bin`; those are removed or replaced
# when found (only ones this hook made: a symlink into a `node_modules`, or a
# file carrying the `# generated-by: .claude/hooks/session-start.sh` marker).
#
# If the installer cannot run (no network to vite.plus / viteplus.dev, or the
# catalog pin cannot be read), `vp` falls back to a one-line re-exec of this
# project's own `node_modules/vite-plus/bin/vp`, and the hook says so.
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
# It fetches nothing from the network beyond the Vite+ installer (above) and
# the lockfile's dependencies. Agents read Effect's API from the installed
# `node_modules/effect` (AGENTS.md § Effect), so there is no CLI or source
# clone to provision.
#
# It does NOT install a Playwright browser. `vp run -r test:unit` drives
# real Chromium, and the image provides one under /opt/pw-browsers. That build
# is rarely the revision the catalog's `playwright` expects (see that entry in
# pnpm-workspace.yaml), so section 5 bridges whatever revision the image
# carries to the wanted one with a directory of symlinks rather than
# downloading anything. Downloading here would be a multi-hundred-megabyte
# fetch on every session start; when no browser is present at all,
# `pnpm exec playwright install chromium` is the one command to run, once.
#
# ## Contract
#
# Idempotent, and never fatal. Every failure path logs and continues, because
# the SessionStart hook must not block a session and a half-provisioned
# container is more useful than a container that refused to start. Callers that
# want hard failure should check the tools themselves afterwards.
#
# Untrusted-content note: beyond fixed, hardcoded paths, this script reads two
# values: the `vite-plus` catalog version in `pnpm-workspace.yaml`, used only
# when it is a plain `MAJOR.MINOR.PATCH`, and the revision numbers in the
# image's /opt/pw-browsers directory names, used only when they are all
# digits. It takes no other input from repo content, issue or PR bodies, or
# anything an agent could have been persuaded to write earlier in a session.
# Do not add such input without revisiting this note — it runs on every
# session start.

set -uo pipefail

log() { printf '[session-start] %s\n' "$1" >&2; }

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LOCAL_BIN="${HOME:-/root}/.local/bin"
VP_GLOBAL_BIN="${HOME:-/root}/.local/share/vite-plus/bin"
# Every file an earlier version of this hook wrote into ~/.local/bin (the
# walking `vp` shim, the `fallow` re-exec shim) carries this prefix.
SHIM_MARKER="# generated-by: .claude/hooks/session-start.sh"

mkdir -p "$LOCAL_BIN" 2>/dev/null || log "cannot create $LOCAL_BIN; continuing"

# Replace $dest with a symlink to $src unless $dest is a real file this hook
# did not make (something deliberately installed it).
link_to() {
  src="$1"
  dest="$2"
  if [ -e "$dest" ] && [ ! -L "$dest" ] \
    && ! grep -qF "$SHIM_MARKER" "$dest" 2>/dev/null; then
    return 0
  fi
  ln -sfn "$src" "$dest" 2>/dev/null || log "could not link $(basename "$dest")"
}

# Remove a PATH entry an earlier version of this hook created.
remove_old_link() {
  dest="$LOCAL_BIN/$1"
  if [ -L "$dest" ]; then
    case "$(readlink "$dest")" in
      */node_modules/*) rm -f "$dest" 2>/dev/null && log "removed old $1 link" ;;
    esac
  elif [ -f "$dest" ] && grep -qF "$SHIM_MARKER" "$dest" 2>/dev/null; then
    rm -f "$dest" 2>/dev/null && log "removed old $1 shim"
  fi
}

# ── 1. Vite+ at the catalog pin ──────────────────────────────────────────────
VP_PIN="$(sed -nE 's/^  vite-plus: "?([0-9]+\.[0-9]+\.[0-9]+)"?$/\1/p' "$PROJECT_DIR/pnpm-workspace.yaml" 2>/dev/null | head -1)"
VP_HAVE="$("$VP_GLOBAL_BIN/vp" --version 2>/dev/null | sed -nE '1s/^vp v([0-9.]+).*$/\1/p')"
if [ -z "$VP_PIN" ]; then
  log "could not read the vite-plus catalog pin; not installing Vite+"
elif [ "$VP_HAVE" != "$VP_PIN" ]; then
  log "installing Vite+ $VP_PIN (have: ${VP_HAVE:-none})…"
  if command -v curl >/dev/null 2>&1 \
    && curl -fsSL https://vite.plus | VP_VERSION="$VP_PIN" bash >/dev/null 2>&1; then
    log "Vite+ $VP_PIN installed"
  else
    log "Vite+ installer failed (is vite.plus / viteplus.dev reachable?); continuing"
  fi
fi

remove_old_link fallow
remove_old_link tsx
if [ -x "$VP_GLOBAL_BIN/vp" ]; then
  link_to "$VP_GLOBAL_BIN/vp" "$LOCAL_BIN/vp"
  link_to "$VP_GLOBAL_BIN/vpx" "$LOCAL_BIN/vpx"
else
  # Fallback: the project's own pinned copy, by its fixed path.
  log "global Vite+ unavailable; \`vp\` runs $PROJECT_DIR's node_modules copy"
  for name in vp vpx; do
    dest="$LOCAL_BIN/$name"
    if [ -e "$dest" ] && [ ! -L "$dest" ] \
      && ! grep -qF "$SHIM_MARKER" "$dest" 2>/dev/null; then
      continue
    fi
    target="$PROJECT_DIR/node_modules/vite-plus/bin/$name"
    [ "$name" = vpx ] && target="$PROJECT_DIR/node_modules/.bin/vpx"
    # `rm` first: writing through `$dest` while it is still a symlink would
    # overwrite whatever it points at.
    rm -f "$dest.tmp" 2>/dev/null
    printf '#!/usr/bin/env bash\n%s (%s fallback)\nexec "%s" "$@"\n' \
      "$SHIM_MARKER" "$name" "$target" >"$dest.tmp" \
      && chmod +x "$dest.tmp" && mv -f "$dest.tmp" "$dest" \
      || { rm -f "$dest.tmp" 2>/dev/null; log "could not write the $name fallback"; }
  done
fi

# ── 2. Bare `node` ───────────────────────────────────────────────────────────
# Only repair a shim that is already failing — see the header for why this is
# conditional. `command -v node` is not enough: the shim exists and resolves,
# then dies on use, so the version call is the real test.
if ! node --version >/dev/null 2>&1; then
  VP_HOME_DIR="${VP_HOME:-${HOME:-/root}/.vite-plus}"
  # Newest cached runtime wins; `sort -V` so 24.9 does not beat 24.18.
  REAL_NODE="$(
    find "$VP_HOME_DIR/js_runtime/node" "${HOME:-/root}/.local/share/vite-plus" \
      -maxdepth 4 -type f -name node -perm -u+x 2>/dev/null | sort -V | tail -1
  )"
  if [ -n "$REAL_NODE" ]; then
    log "bare \`node\` is broken; pointing it at $REAL_NODE"
    # The shim lives in a user-owned directory even though the runtime cache
    # beneath it may be root-owned, so this needs no privileges.
    if [ -d "$VP_HOME_DIR/bin" ]; then
      ln -sfn "$REAL_NODE" "$VP_HOME_DIR/bin/node" 2>/dev/null \
        || link_to "$REAL_NODE" "$LOCAL_BIN/node"
    else
      link_to "$REAL_NODE" "$LOCAL_BIN/node"
    fi
  else
    log "bare \`node\` is broken and no cached runtime was found; \`vp\`-routed commands still work"
  fi
fi

# ── 3. Dependencies ──────────────────────────────────────────────────────────
# Unconditional, not only when node_modules is absent: a prebaked container can
# carry a tree built from an OLDER lockfile, and stale dependencies masquerade
# as `trunk` breakage. `--frozen-lockfile` is a sub-second no-op when in sync.
# `vp install` uses the `packageManager` pin.
if [ -f "$PROJECT_DIR/pnpm-lock.yaml" ]; then
  log "syncing dependencies against the lockfile…"
  # The fallback `vp` points into node_modules, which may not exist yet, so
  # only the global CLI installs; without it, pnpm does.
  if [ -x "$VP_GLOBAL_BIN/vp" ]; then
    (cd "$PROJECT_DIR" && "$VP_GLOBAL_BIN/vp" install --frozen-lockfile >/dev/null 2>&1) \
      || log "dependency install failed; continuing"
  elif command -v corepack >/dev/null 2>&1; then
    (cd "$PROJECT_DIR" && corepack pnpm install --frozen-lockfile >/dev/null 2>&1) \
      || log "dependency install failed; continuing"
  else
    (cd "$PROJECT_DIR" && pnpm install --frozen-lockfile >/dev/null 2>&1) \
      || log "dependency install failed; continuing"
  fi
fi

# ── 4. First-checkout codegen ────────────────────────────────────────────────
# `svelte-kit sync` writes the package's ambient types under `.svelte-kit/`.
# Without it, `svelte-check` and `svelte-package` both fail on a fresh checkout
# or worktree with errors that name a missing generated file rather than the
# missing codegen step. Cheap and idempotent, so it runs unconditionally.
if [ -d "$PROJECT_DIR/node_modules" ]; then
  log "running svelte-kit sync…"
  (cd "$PROJECT_DIR" && "$LOCAL_BIN/vp" run --filter ./packages/prosekit-svelte --filter ./packages/prosekit-flowchart sync >/dev/null 2>&1) \
    || log "codegen failed; run \`vp run -r sync\` by hand"
fi

# ── 5. Playwright browser bridge ─────────────────────────────────────────────
# The catalog pins `playwright` 1.60.0, which looks for Chromium revision 1223
# (PW_WANT_REV); the image ships some other revision under /opt/pw-browsers
# (1194 when this was written, 1243 since). Playwright finds a browser purely
# by path — <PLAYWRIGHT_BROWSERS_PATH>/<name>-<revision>/<the per-platform
# layout in playwright-core's EXECUTABLE_PATHS> — so a directory of symlinks
# carrying PW_WANT_REV's names but pointing at the image's build is enough for
# `vp run -r test:unit` to launch it. The bridge uses the newest revision the
# image carries with both a full Chromium and a headless shell, in either of
# the image's two layouts: the older `chrome-linux/{chrome,headless_shell}`
# builds and the Chrome for Testing `chrome-linux64/chrome` +
# `chrome-headless-shell-linux64/chrome-headless-shell` ones. Both of
# Playwright's layouts are linked: x64 CfT names (`chrome-linux64/chrome`,
# `chrome-headless-shell-linux64/chrome-headless-shell`) and the arm64 ones
# (`chrome-linux/…`). Headless runs use the headless shell, so that is the one
# the suites actually launch.
#
# /opt/pw-browsers is read, never written. The bridge only applies while the
# image lacks PW_WANT_REV; once the image carries it, this section is a no-op.
# Bump PW_WANT_REV together with the catalog's `playwright` entry.
#
# The variable reaches the agent's shells through $CLAUDE_ENV_FILE, which
# Claude Code sources before each Bash command — the one way a SessionStart
# hook can export into its caller. Without it (a devcontainer invoking this
# file directly), the export line is logged for the caller to apply.
PW_IMAGE_DIR="/opt/pw-browsers"
PW_WANT_REV="1223"
PW_BRIDGE_DIR="${HOME:-/root}/.cache/prosekit-pw-browsers"
# The newest image revision with both builds, and its layout.
PW_HAVE_REV=""
PW_FULL=""
PW_SHELL_DIR=""
PW_SHELL_BIN=""
for rev in $(
  find "$PW_IMAGE_DIR" -mindepth 1 -maxdepth 1 -name 'chromium-*' -printf '%f\n' 2>/dev/null \
    | sed -nE 's/^chromium-([0-9]+)$/\1/p' | sort -rn
); do
  shell_root="$PW_IMAGE_DIR/chromium_headless_shell-$rev"
  if [ -x "$PW_IMAGE_DIR/chromium-$rev/chrome-linux64/chrome" ] \
    && [ -x "$shell_root/chrome-headless-shell-linux64/chrome-headless-shell" ]; then
    PW_FULL="$PW_IMAGE_DIR/chromium-$rev/chrome-linux64"
    PW_SHELL_DIR="$shell_root/chrome-headless-shell-linux64"
    PW_SHELL_BIN="$PW_SHELL_DIR/chrome-headless-shell"
  elif [ -x "$PW_IMAGE_DIR/chromium-$rev/chrome-linux/chrome" ] \
    && [ -x "$shell_root/chrome-linux/headless_shell" ]; then
    PW_FULL="$PW_IMAGE_DIR/chromium-$rev/chrome-linux"
    PW_SHELL_DIR="$shell_root/chrome-linux"
    PW_SHELL_BIN="$PW_SHELL_DIR/headless_shell"
  else
    continue
  fi
  PW_HAVE_REV="$rev"
  break
done
if [ -d "$PW_IMAGE_DIR/chromium-$PW_WANT_REV" ] \
  && [ -d "$PW_IMAGE_DIR/chromium_headless_shell-$PW_WANT_REV" ]; then
  : # The image already carries the wanted revision; nothing to bridge.
elif [ -n "$PW_HAVE_REV" ]; then
  log "bridging Chromium $PW_HAVE_REV as $PW_WANT_REV under $PW_BRIDGE_DIR…"
  full="$PW_BRIDGE_DIR/chromium-$PW_WANT_REV"
  shell="$PW_BRIDGE_DIR/chromium_headless_shell-$PW_WANT_REV"
  if mkdir -p "$full" "$shell/chrome-headless-shell-linux64" 2>/dev/null; then
    ln -sfn "$PW_FULL" "$full/chrome-linux64" 2>/dev/null \
      || log "could not link $full/chrome-linux64"
    ln -sfn "$PW_FULL" "$full/chrome-linux" 2>/dev/null \
      || log "could not link $full/chrome-linux"
    ln -sfn "$PW_SHELL_DIR" "$shell/chrome-linux" 2>/dev/null \
      || log "could not link $shell/chrome-linux"
    # Both image layouts' headless shells resolve their resources from their
    # own directory (the older `headless_shell` is a wrapper that execs the
    # absolute path of `headless_shell.real`; the CfT one sits beside its
    # `.pak` files), so a symlink under the CfT name works for either.
    ln -sfn "$PW_SHELL_BIN" \
      "$shell/chrome-headless-shell-linux64/chrome-headless-shell" 2>/dev/null \
      || log "could not link the headless shell under $shell"
    # ffmpeg is linked under the image's own revision names.
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
  log "no Chromium build under $PW_IMAGE_DIR to bridge; run \`pnpm exec playwright install chromium\` once"
fi

exit 0
