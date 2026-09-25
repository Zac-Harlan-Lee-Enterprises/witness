#!/usr/bin/env bash
# agent-status.sh — read-only orientation dump (Pillar 4). Always exits 0.
#
# Shows: services/ports, health, storage model, git state, feature registry,
# whether it compiles, and the content-governance status of the chapter.

set -uo pipefail
cd "$(dirname "$0")"

DEV_PORT="${WITNESS_DEV_PORT:-5391}"
PREVIEW_PORT="${WITNESS_PREVIEW_PORT:-4391}"

hr() { printf '%.0s─' {1..70}; echo; }
section() { hr; printf "  %s\n" "$1"; hr; }

section "Services"
for port in "$DEV_PORT" "$PREVIEW_PORT"; do
  name=$([[ "$port" == "$DEV_PORT" ]] && echo "dev server" || echo "preview (prod build)")
  if pid="$(lsof -ti:"$port" 2>/dev/null | head -n1)" && [[ -n "$pid" ]]; then
    echo "  $name  :$port  UP   (pid $pid)"
  else
    echo "  $name  :$port  DOWN"
  fi
done

section "Health"
for port in "$DEV_PORT" "$PREVIEW_PORT"; do
  url="http://localhost:$port/"
  code="$(curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
  if [[ "$code" == "200" ]]; then echo "  $url → 200"; else echo "  $url → ${code:-unreachable}"; fi
done

section "Data & storage"
echo "  Backend: none (static site). Database: none."
echo "  Player data: browser IndexedDB 'witness-game' (profiles, saves, settings)."
echo "  Save schema version: $(grep -oE 'CURRENT_SAVE_VERSION = [0-9]+' src/domain/save.ts | awk '{print $3}')"

section "Git"
if git rev-parse --git-dir >/dev/null 2>&1; then
  echo "  branch:      $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  echo "  last commit: $(git log -1 --pretty=format:'%h %s (%ar)' 2>/dev/null || echo '(no commits yet)')"
  echo "  dirty files: $(git status --porcelain | wc -l | tr -d ' ')"
  for h in pre-commit commit-msg pre-push; do
    [[ -x "$(git rev-parse --git-path hooks)/$h" ]] && echo "  hook $h: installed" || echo "  hook $h: MISSING (bash init.sh installs it)"
  done
else
  echo "  not a git repo"
fi

section "Feature registry"
if [[ -f feature_list.json ]] && command -v jq >/dev/null 2>&1; then
  total=$(jq 'length' feature_list.json)
  pass=$(jq '[.[] | select(.passes==true)] | length' feature_list.json)
  echo "  total: $total   passing: $pass   failing: $((total - pass))"
  jq -r '[.[] | select(.passes==false)] | sort_by(.priority) | .[:5][] | "  next → [\(.priority)] \(.id): \(.description[0:70])"' feature_list.json
else
  echo "  feature_list.json or jq missing"
fi

section "Build"
if npx --no-install tsc --noEmit -p tsconfig.json >/dev/null 2>&1; then
  echo "  typecheck: OK"
else
  echo "  typecheck: FAILING (npm run typecheck)"
fi
[[ -d dist ]] && echo "  last production build: $(date -r dist '+%Y-%m-%d %H:%M')" || echo "  no production build yet (npm run build)"

section "Content governance"
npx --no-install tsx scripts/validate-content.ts 2>&1 | sed 's/^/  /' || true

section "Environment (public build-time settings)"
for key in VITE_BASE_PATH VITE_GAME_TITLE VITE_CONTENT_MODE; do
  val="$(grep -E "^${key}=" .env.local 2>/dev/null | cut -d= -f2- || true)"
  echo "  $key=${val:-(default)}"
done
hr
echo "Done."
exit 0
