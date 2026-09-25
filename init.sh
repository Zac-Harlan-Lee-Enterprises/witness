#!/usr/bin/env bash
# init.sh — Deterministic bootstrap for Witness (Pillar 1).
#
#   bash init.sh          install what's missing, install git hooks, start the
#                         Vite dev server in the background, wait for a real 200
#   bash init.sh --stop   stop everything this script started (idempotent)
#
# Safe to run repeatedly. First command of every agent session.
# The game has NO backend and NO database: the only service is the dev server,
# and all player data lives in the browser's IndexedDB.

set -euo pipefail
IFS=$'\n\t'
cd "$(dirname "$0")"

PROJECT_NAME="Witness (Road to Jericho)"
# Project-specific ports (NOT Vite's default 5173, which other local apps use).
DEV_PORT="${WITNESS_DEV_PORT:-5391}"
PREVIEW_PORT="${WITNESS_PREVIEW_PORT:-4391}"
export WITNESS_DEV_PORT="$DEV_PORT" WITNESS_PREVIEW_PORT="$PREVIEW_PORT"
REPO_DIR="$(pwd -P)"
HEALTH_URL="http://localhost:${DEV_PORT}/"
HEALTH_TIMEOUT_SECS=60
MIN_NODE_MAJOR=22

log()  { printf "\033[1;34m[init]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[ ok ]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*" >&2; }
die()  { printf "\033[1;31m[fail]\033[0m %s\n" "$*" >&2; exit 1; }

# Stop a process on $1 ONLY if it belongs to this project (its working
# directory is inside this repo). Anything else is another app: in "strict"
# mode refuse and explain; in "lenient" mode (--stop) just leave it alone.
# Never kill by port alone — that once stopped an unrelated app on 5173.
free_port() {
  local port="$1" mode="${2:-strict}" pids pid cwd cmd
  pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0
  for pid in $pids; do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n1)"
    cmd="$(ps -o comm= -p "$pid" 2>/dev/null || echo '?')"
    if [[ -n "$cwd" && ( "$cwd" == "$REPO_DIR" || "$cwd" == "$REPO_DIR"/* ) ]]; then
      log "Stopping this project's earlier process $pid on port $port"
      kill "$pid" 2>/dev/null || true
      sleep 0.5
      if kill -0 "$pid" 2>/dev/null; then kill -9 "$pid" 2>/dev/null || true; fi
    elif [[ "$mode" == "strict" ]]; then
      die "Port $port is in use by another application ($cmd, pid $pid, in ${cwd:-unknown}). Not touching it. Choose another port, e.g.: WITNESS_DEV_PORT=5392 bash init.sh"
    else
      warn "Port $port is used by another application ($cmd, pid $pid) — leaving it alone"
    fi
  done
}

wait_for_url() {
  local url="$1" timeout="$2" elapsed=0
  log "Waiting for $url (timeout ${timeout}s)"
  while (( elapsed < timeout )); do
    # Health = HTTP 200 AND the app shell is served (not just "a process started").
    if curl -fsS "$url" 2>/dev/null | grep -q 'id="root"'; then
      ok "$url is healthy"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "---- last 30 lines of .logs/dev.log ----" >&2
  tail -n 30 .logs/dev.log >&2 || true
  die "Timed out waiting for $url"
}

# ── --stop ─────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--stop" ]]; then
  log "Stopping $PROJECT_NAME"
  if [[ -d .pids ]]; then
    for pidfile in .pids/*.pid; do
      [[ -f "$pidfile" ]] || continue
      pid="$(cat "$pidfile")"
      if kill -0 "$pid" 2>/dev/null; then
        log "Stopping $(basename "$pidfile" .pid) (PID $pid)"
        kill "$pid" 2>/dev/null || true
      fi
      rm -f "$pidfile"
    done
  fi
  free_port "$DEV_PORT" lenient
  free_port "$PREVIEW_PORT" lenient
  ok "Stopped. Safe to re-run: bash init.sh"
  exit 0
fi

# ── 0. Pre-flight ──────────────────────────────────────────────────────────
log "Bootstrapping $PROJECT_NAME"
[[ "$(id -u)" == "0" ]] && die "Do not run init.sh as root. Run as your normal user."
[[ -n "${SUDO_USER:-}" ]] && die "Do not run init.sh with sudo."
command -v node >/dev/null 2>&1 || die "Node.js is not installed. Install Node ${MIN_NODE_MAJOR}+ (see .nvmrc)."
command -v npm >/dev/null 2>&1 || die "npm is not installed."
command -v curl >/dev/null 2>&1 || die "curl is required for the health check."
node_major="$(node -p 'process.versions.node.split(".")[0]')"
(( node_major >= MIN_NODE_MAJOR )) || die "Node ${MIN_NODE_MAJOR}+ required (found $(node -v)). Try: nvm use"
ok "Node $(node -v), npm $(npm -v)"
if [[ -f .env.local ]]; then
  ok "Using .env.local (public build-time settings only — this app has no secrets)"
fi

# ── 1. Stale processes (only this project's) ───────────────────────────────
free_port "$DEV_PORT" strict

# ── 2. Dependencies (only when the lockfile changed) ────────────────────────
lock_hash="$(shasum -a 256 package-lock.json | cut -d' ' -f1)"
stamp="node_modules/.init-lock-hash"
if [[ ! -d node_modules || ! -f "$stamp" || "$(cat "$stamp" 2>/dev/null)" != "$lock_hash" ]]; then
  log "Installing dependencies (npm ci)"
  npm ci --no-audit --no-fund
  echo "$lock_hash" > "$stamp"
  ok "Dependencies installed"
else
  ok "Dependencies up to date"
fi

# ── 3. Git hooks (symlinked so they update with the repo) ───────────────────
if git rev-parse --git-dir >/dev/null 2>&1; then
  hooks_dir="$(git rev-parse --git-path hooks)"
  mkdir -p "$hooks_dir"
  for h in pre-commit commit-msg pre-push; do
    ln -sf "../../scripts/hooks/$h" "$hooks_dir/$h"
    chmod +x "scripts/hooks/$h"
  done
  ok "Git hooks installed (pre-commit, commit-msg, pre-push)"
else
  warn "Not a git repository — hooks not installed (run: git init)"
fi

# ── 4. E2E browser (optional; never blocks startup) ────────────────────────
if npx --no-install playwright --version >/dev/null 2>&1; then
  if ! ls "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"/chromium-* >/dev/null 2>&1 \
     && ! ls "$HOME/.cache/ms-playwright"/chromium-* >/dev/null 2>&1; then
    warn "Playwright Chromium not installed — E2E tests need: npx playwright install chromium"
  fi
fi

# ── 5. Content validation (fast; catches broken chapter data before you play) ─
log "Validating chapter content"
npx --no-install tsx scripts/validate-content.ts > .content-validation.log 2>&1 || {
  cat .content-validation.log >&2
  die "Chapter content is invalid — fix it before starting (npm run content:validate)"
}
rm -f .content-validation.log
ok "Chapter content valid"

# ── 6. Start the dev server ────────────────────────────────────────────────
mkdir -p .logs .pids
log "Starting Vite dev server on port $DEV_PORT"
nohup npx --no-install vite --port "$DEV_PORT" --strictPort > .logs/dev.log 2>&1 &
echo $! > .pids/dev.pid

# ── 7. Health ──────────────────────────────────────────────────────────────
wait_for_url "$HEALTH_URL" "$HEALTH_TIMEOUT_SECS"

# ── 8. Report ──────────────────────────────────────────────────────────────
ok "Bootstrap complete"
echo
echo "  Game (dev):  $HEALTH_URL"
echo "  PID:         $(cat .pids/dev.pid)  (.pids/dev.pid)"
echo "  Logs:        .logs/dev.log"
echo "  Stop:        bash init.sh --stop"
echo
echo "Next: bash agent-status.sh   ·   bash quality-sweep.sh   ·   npm test"
