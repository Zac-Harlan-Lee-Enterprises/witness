#!/usr/bin/env bash
# quality-sweep.sh — drift detector (Pillar 4). Exits non-zero on any finding.
# Run locally any time and in CI (.github/workflows/ci.yml).

set -uo pipefail
IFS=$'\n\t'
# Always sweep the repo root, even if this script is moved.
cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$0")"

EXIT=0
fail() { printf "\033[1;31m[fail]\033[0m %s\n" "$*" >&2; EXIT=1; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*" >&2; }
ok()   { printf "\033[1;32m[ ok ]\033[0m %s\n" "$*"; }
IN_CI="${CI:-}"

# shellcheck disable=SC1091
if ! source scripts/lib/policy.sh 2>/dev/null; then
  fail "scripts/lib/policy.sh missing — policy values undefined"
fi

# Files that can ship: tracked files, plus untracked-but-not-ignored ones
# (a brand-new repo has nothing tracked yet — scanning nothing would be a lie).
gitgrep() { git grep --untracked --exclude-standard "$@"; }

echo "── Architecture tests ─────────────────────────────────────────────"
if npx --no-install vitest run --project unit tests/architecture > .sweep-arch.log 2>&1; then
  ok "Architecture rules hold ($(grep -oE '[0-9]+ passed' .sweep-arch.log | head -1))"
else
  fail "Architecture tests failed:"
  grep -E 'FAIL|Why:|Fix:' .sweep-arch.log | head -30 >&2
fi
rm -f .sweep-arch.log

echo "── Chapter content ────────────────────────────────────────────────"
if npx --no-install tsx scripts/validate-content.ts > .sweep-content.log 2>&1; then
  ok "Content schema, integrity and reachability valid"
else
  fail "Content validation failed:"
  cat .sweep-content.log >&2
fi
rm -f .sweep-content.log

echo "── Config integrity & feature registry ────────────────────────────"
if command -v jq >/dev/null 2>&1; then
  for f in feature_list.json package.json knip.json .claude/settings.json public/manifest.webmanifest; do
    [[ -f "$f" ]] || continue
    jq empty "$f" >/dev/null 2>&1 && ok "$f is valid JSON" || fail "$f is invalid JSON"
  done
  if [[ -f feature_list.json ]]; then
    dupes=$(jq -r '[.[].id] | group_by(.) | map(select(length>1)) | flatten | unique | .[]' feature_list.json)
    [[ -n "$dupes" ]] && fail "feature_list.json has duplicate ids: $dupes"
    missing=$(jq -r '.[] | select((.verification // "") == "" or (.hermetic|type) != "boolean" or (.passes|type) != "boolean") | .id' feature_list.json)
    [[ -n "$missing" ]] && fail "feature_list.json entries missing verification/hermetic/passes: $missing"
    # Re-run every hermetic entry that claims to pass, so a green flag can't outlive its behaviour.
    while IFS=$'\t' read -r id verification; do
      [[ -z "$id" ]] && continue
      if bash -c "$verification" >/dev/null 2>&1; then
        ok "registry '$id' re-verified"
      else
        fail "registry '$id' claims passes:true but its verification now FAILS:"
        echo "      $verification" >&2
        echo "      → fix the regression, or flip passes to false" >&2
      fi
    done < <(jq -r '.[] | select(.passes==true and .hermetic==true) | [.id, .verification] | @tsv' feature_list.json)
  fi
else
  fail "jq not installed — cannot check config integrity"
fi

echo "── Debug artifacts in source ──────────────────────────────────────"
if gitgrep -nE 'console\.log\(|^\s*debugger;?\s*$' -- 'src/*.ts' 'src/*.tsx' 2>/dev/null; then
  fail "Debug artifacts found in src/"
else
  ok "No debug artifacts in src/"
fi

echo "── Documentation validity ─────────────────────────────────────────"
# Validity, not age: every backtick-quoted path and `bash x.sh` in the entry
# docs must exist. (Age is never a failure — that trains no-op edits.)
for doc in AGENTS.md README.md; do
  [[ -f "$doc" ]] || { fail "$doc not found"; continue; }
  broken=0
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    case "$ref" in http*|*' '*|*'<'*|*'*'*|*'{'*|*'='*|@/*|~/*) continue ;; esac
    ref="${ref%%#*}"; ref="${ref%%:*}"
    [[ -z "$ref" ]] && continue
    # Generated output (gitignored) is created by commands, not stored in the repo.
    git check-ignore -q "$ref" 2>/dev/null && continue
    if [[ ! -e "$ref" ]]; then fail "$doc references '$ref' — not found"; broken=1; fi
  done < <({ grep -oE '`[^`]+/[^`]+`' "$doc" | tr -d '`'; grep -oE 'bash [a-zA-Z0-9_./-]+\.sh' "$doc" | awk '{print $2}'; grep -oE '\]\((docs|src|tests|e2e|scripts)/[^)#]+' "$doc" | sed 's/^](//'; } 2>/dev/null | sort -u)
  (( broken == 0 )) && ok "$doc references all resolve"
done

echo "── Secret scan ────────────────────────────────────────────────────"
if [[ -n "${SECRET_RE:-}" ]]; then
  if gitgrep -InE "$SECRET_RE" -- . ':!package-lock.json' 2>/dev/null | grep -v 'pragma: allowlist-secret'; then
    fail "Possible secret found — investigate immediately"
  else
    ok "No secret patterns in shippable files"
  fi
fi
if gitgrep -nE 'VITE_[A-Z_]*(SECRET|TOKEN|KEY|PASSWORD)' -- . 2>/dev/null; then
  fail "A VITE_* variable looks like a secret — everything VITE_* ships to the browser"
fi

echo "── Dead code ──────────────────────────────────────────────────────"
if npx --no-install knip --no-progress > .sweep-knip.log 2>&1; then
  ok "No unused files, exports or dependencies (knip)"
else
  fail "knip found unused code:"
  head -30 .sweep-knip.log >&2
fi
rm -f .sweep-knip.log

echo "── Action guardrails ──────────────────────────────────────────────"
# No approval gates (the owner's decision, 2026-09-25); only commands that
# can't be undone stay blocked, in settings and in the guard hook.
if [[ -f .claude/settings.json ]] && command -v jq >/dev/null 2>&1; then
  jq -e '.permissions.deny | index("Bash(git push --force:*)")' .claude/settings.json >/dev/null 2>&1 \
    && ok ".claude/settings.json denies force-push" || fail ".claude/settings.json does not deny 'Bash(git push --force:*)'"
else
  fail "No .claude/settings.json — nothing blocks unrecoverable commands"
fi

GUARD=scripts/hooks/guard-destructive-commands.sh
if [[ -x "$GUARD" ]] && bash "$GUARD" --self-test >/dev/null 2>&1; then
  ok "PreToolUse guard self-test passes (blocks unrecoverable commands, allows the rest)"
else
  fail "guard self-test FAILED — run: bash $GUARD --self-test"
fi

for h in pre-commit pre-push; do
  if [[ -x "$(git rev-parse --git-path hooks 2>/dev/null)/$h" ]]; then
    ok "git hook installed: $h"
  elif [[ -n "$IN_CI" ]]; then
    warn "git hook $h not installed (expected in CI — CI runs the same checks directly)"
  else
    fail "git hook NOT installed: $h  → bash init.sh"
  fi
done

if [[ -n "$IN_CI" ]]; then
  warn "Skipping branch-protection check in CI (needs an admin token; run locally)"
elif command -v gh >/dev/null 2>&1 && git remote get-url origin >/dev/null 2>&1; then
  slug=$(git remote get-url origin | sed -E 's#.*github\.com[:/]([^/]+/[^/.]+)(\.git)?#\1#')
  if ! prot=$(gh api "repos/$slug/branches/main/protection" 2>/dev/null); then prot=""; fi
  if [[ -z "$prot" ]]; then
    warn "main is not protected on GitHub (optional: REQUIRED_REVIEWS=0 bash harden-github.sh $slug)"
  elif ! printf '%s' "$prot" | jq -e '.enforce_admins.enabled == true' >/dev/null 2>&1; then
    warn "main is protected but enforce_admins is off"
  else
    ok "main is protected and admins cannot bypass"
  fi
else
  warn "No GitHub remote yet — server-side protection (harden-github.sh) not applied"
fi

echo
if (( EXIT == 0 )); then ok "Sweep clean."; else fail "Sweep found issues."; fi
exit "$EXIT"
