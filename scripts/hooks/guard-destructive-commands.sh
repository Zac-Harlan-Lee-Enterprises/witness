#!/usr/bin/env bash
# guard-destructive-commands.sh — Claude Code PreToolUse hook (Layer 2 of 3).
#
# Scope (the owner's decision, 2026-09-25): agents work without approval
# gates here. They may push (main included), open, approve and merge pull
# requests, run workflows and change repo settings. This hook blocks only
# UNRECOVERABLE accidents: force-push, history rewriting, bypassing the git
# hooks, recursive deletes of home or root, and cloud deploys or package
# publishing this project never does.
#
# Why a hook as well as the settings deny list: deny rules are PREFIX matches
# against the command string and miss compound commands such as
# `cd /repo && git push --force`. This hook regex-scans the WHOLE command
# string, so placement and chaining do not matter.
#
# HARD-WON RULES OF THIS FILE (each fixed a real bug — keep them):
#   * Any regex containing & ; | must live in a VARIABLE. Unquoted, those
#     characters are bash syntax errors inside [[ =~ ]] — and a guard that
#     dies with a syntax error exits 2, silently blocking EVERY command.
#   * Match branch names by exact TOKEN, never by substring: a suffix match
#     blocks legitimate branches like docs/update-main.
#   * Strip quoted strings before flag/keyword rules, so commit-message TEXT
#     ("document the -n flag", "--admin") can never trip a rule.
#   * Normalize whitespace with tr, not sed: BSD sed treats '\+' as a literal
#     plus, making 's/[[:space:]]\+/ /g' a silent no-op on macOS.
#
# Self-test (run it from quality-sweep.sh and the feature registry):
#   bash scripts/hooks/guard-destructive-commands.sh --self-test
# It asserts both directions: destructive commands BLOCK, benign look-alikes
# ALLOW (regressions for past false positives). Extend it with every rule you
# add or loosen.
#
# Contract: exit 0 = allow, exit 2 = BLOCK (stderr is shown to the agent),
# any other exit = non-blocking error. Never exit 1 from the hook path.

set -uo pipefail

# Shared policy values; safe fallback if the lib is missing.
_LIB="$(git rev-parse --show-toplevel 2>/dev/null || echo .)/scripts/lib/policy.sh"
# shellcheck disable=SC1090
[[ -f "$_LIB" ]] && source "$_LIB"
: "${PROTECTED_BRANCHES_RE:=(main|master|trunk|develop|release(/[^[:space:]]*)?|prod|production)}"

# --------------------------------------------------------------------------
# --self-test
# --------------------------------------------------------------------------
if [[ "${1:-}" == "--self-test" ]]; then
  self="${BASH_SOURCE[0]}"
  rc=0
  probe() {  # probe <expect: block|allow> <command string>
    local expect="$1" cmd="$2" got payload esc
    # jq encodes quotes/backslashes correctly; naive printf would produce
    # invalid JSON for commands containing '"' — the hook would then extract
    # an empty command and every "block" probe would falsely report a pass.
    payload=""
    if command -v jq >/dev/null 2>&1; then
      payload=$(jq -n --arg c "$cmd" '{tool_input:{command:$c}}' 2>/dev/null) || payload=""
    fi
    if [[ -z "$payload" ]]; then
      esc=${cmd//\\/\\\\}
      esc=${esc//\"/\\\"}
      payload=$(printf '{"tool_input":{"command":"%s"}}' "$esc")
    fi
    if printf '%s' "$payload" | bash "$self" >/dev/null 2>&1; then
      got="allow"
    else
      got="block"
    fi
    if [[ "$got" == "$expect" ]]; then
      printf '[self-test]   ok (%s): %s\n' "$expect" "$cmd"
    else
      printf '[self-test] FAIL (want %s, got %s): %s\n' "$expect" "$got" "$cmd" >&2
      rc=1
    fi
  }
  # Must block:
  probe block 'git push origin +feature'
  probe block 'git push --force origin feat/x'
  probe block 'cd /repo && git push --force origin main'
  probe block 'git reset --hard HEAD~3'
  probe block 'rm -rf ~'
  probe block 'git commit -n -m msg'
  probe block 'git commit --no-verify -m msg'
  probe block 'gh pr merge 42 --admin'
  probe block 'terraform apply -auto-approve'
  # Must allow: the owner lets agents merge, push, deploy and configure.
  probe allow 'cd /tmp && gh pr merge 1 --squash'
  probe allow 'gh pr review 7 --approve'
  probe allow 'git push origin main'
  probe allow 'git push origin HEAD:main'
  probe allow 'gh api -X PATCH repos/o/r -f allow_auto_merge=true'
  probe allow 'gh api --method PUT repos/o/r/branches/main/protection'
  probe allow 'gh api -X POST repos/o/r/pages -f build_type=workflow'
  probe allow 'gh workflow run deploy-pages.yml --ref main'
  # Must allow (regressions for past false positives):
  probe allow 'git commit -m fix && git log --oneline -n 5'
  probe allow 'git commit -m "document the -n flag"'
  probe allow 'git push -u origin docs/remain'
  probe allow 'git push origin feature/main-page'
  probe allow 'gh api repos/o/r/pulls/42'
  probe allow 'grep -rn -- --no-verify docs/'
  probe allow 'echo x | grep -n foo'
  probe allow 'terraform plan'
  # Project-specific (Witness): routine work must never be blocked…
  probe allow 'npm ci'
  probe allow 'npm run build'
  probe allow 'npx vitest run --project unit'
  probe allow 'npx playwright test --project=desktop-chromium'
  probe allow 'bash init.sh --stop'
  probe allow 'bash quality-sweep.sh'
  probe allow 'git push -u origin feat/road-to-jericho'
  # Publishing a package is never part of this project.
  probe block 'npm publish'
  exit "$rc"
fi

payload=$(cat)

# Extract the command without requiring jq (jq is not on every Windows dev box).
# NEVER trust `command -v jq` alone: a jq that EXISTS but fails (broken install,
# wrong arch) returns an empty string, which under the old `[[ -z "$cmd" ]] &&
# exit 0` meant "no command, allow" — silently disabling every rule below while
# every existence check still passed. Verify we actually got output, and fail
# CLOSED when a payload plainly carries a command we could not parse.
cmd=""
if command -v jq >/dev/null 2>&1; then
  cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null) || cmd=""
fi
if [[ -z "$cmd" ]]; then
  cmd=$(printf '%s' "$payload" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')
  # Undo JSON string escaping that jq would have handled for us.
  cmd=${cmd//\\\"/\"}
  cmd=${cmd//\\\\/\\}
fi

if [[ -z "$cmd" ]]; then
  if printf '%s' "$payload" | grep -q '"command"'; then
    echo "BLOCKED: guard could not parse the command out of the tool payload." >&2
    echo "  Refusing to allow an unverified command. Check jq and this hook." >&2
    exit 2
  fi
  exit 0
fi

# Normalize: strip line continuations, collapse whitespace runs (tr — see
# header). noq additionally strips quoted strings for flag/keyword rules.
norm=$(printf '%s' "$cmd" | sed 's/\\ / /g' | tr '\n' ' ' | tr -s '[:space:]' ' ')
noq=$(printf '%s' "$norm" | sed "s/\"[^\"]*\"//g; s/'[^']*'//g")

block() {
  cat >&2 <<EOF
BLOCKED by scripts/hooks/guard-destructive-commands.sh

  Command : $cmd
  Rule    : $1
  Why     : $2

This can't be undone. Do not attempt to work around it — do not retry with
different syntax, do not edit this hook, do not edit .claude/settings.json.

What to do instead:
  $3
EOF
  exit 2
}

# Regexes containing & ; | (bash syntax errors when written inline in [[ =~ ]]):
re_push_short_f='git[[:space:]]+push[^&;|]*[[:space:]]-f([[:space:]]|$)'
re_commit_n='git[[:space:]]+commit[^&;|]*[[:space:]]-[a-zA-Z]*n([[:space:]]|$)'
re_gh_admin='gh[[:space:]]+[^&;|]*--(admin|bypass)'
re_no_verify='(git|gh)[[:space:]][^&;|]*--no-verify'

# --------------------------------------------------------------------------
# 1. Force-pushing (token-based — no substring matching)
# --------------------------------------------------------------------------
if [[ "$norm" =~ git[[:space:]]+push ]]; then
  if [[ "$noq" =~ (--force|--force-with-lease)([[:space:]]|$) ]] || \
     [[ "$noq" =~ $re_push_short_f ]]; then
    block "no force-push, ever" \
          "Force-push rewrites shared history and can destroy other people's commits." \
          "If history needs fixing, hand the branch to a human."
  fi

  # Examine each argument token after 'git push' (up to a command separator).
  push_args=$(printf '%s' "$norm" | sed 's/.*git[[:space:]]push//; s/[&;|].*$//')
  for tok in $push_args; do
    case "$tok" in
      -*) continue ;;                      # flags
      origin|upstream) continue ;;         # remotes
    esac
    if [[ "$tok" =~ ^\+ ]]; then
      block "no force-push via '+refspec'" \
            "'git push origin +branch' is a force-push in disguise." \
            "Push without the '+', or hand the branch to a human."
    fi
  done
fi

if [[ "$noq" =~ git[[:space:]]+(reset[[:space:]]+--hard|filter-branch|update-ref|reflog[[:space:]]+delete) ]]; then
  block "no destructive history rewriting" \
        "These silently discard committed work with no undo." \
        "Use 'git revert', or hand it to a human."
fi

# --------------------------------------------------------------------------
# 2. Bypassing the git hooks
# --------------------------------------------------------------------------
# Scoped to the relevant command segment (no spanning across && / ; / |) and
# evaluated on the quote-stripped string, so message/doc text never matches.
if [[ "$noq" =~ $re_no_verify ]] || \
   [[ "$noq" =~ $re_commit_n ]] || \
   [[ "$noq" =~ (HUSKY=0|SKIP_HOOKS) ]] || \
   [[ "$noq" =~ $re_gh_admin ]]; then
  block "no bypassing commit/merge gates" \
        "The gates exist because reviews get skipped under time pressure. Turning them off is never the fix." \
        "Fix what the gate is complaining about."
fi

# --------------------------------------------------------------------------
# 3. Cloud deploys and package publishing (never part of this project; its
#    one deploy, GitHub Pages, runs from CI and may be triggered freely)
# --------------------------------------------------------------------------
if [[ "$noq" =~ (az[[:space:]]+(webapp|functionapp|containerapp)[[:space:]]+(deploy|deployment|up)) ]] || \
   [[ "$noq" =~ (msdeploy|Publish-AzWebApp|az[[:space:]]+group[[:space:]]+delete) ]] || \
   [[ "$noq" =~ (terraform[[:space:]]+(apply|destroy)|pulumi[[:space:]]+(up|destroy)) ]] || \
   [[ "$noq" =~ (kubectl[[:space:]]+(apply|delete|rollout)|helm[[:space:]]+(install|upgrade|uninstall)) ]] || \
   [[ "$noq" =~ (npm[[:space:]]+publish|docker[[:space:]]+push|dotnet[[:space:]]+nuget[[:space:]]+push) ]]; then
  block "no cloud deploys or package publishing" \
        "This project has no cloud infrastructure or packages; such a command is a mistake with blast radius outside this repo." \
        "Check the command. The site deploys through GitHub Pages."
fi

# dotnet publish is fine locally; blocked when it targets a server/share.
if [[ "$noq" =~ dotnet[[:space:]]+publish ]] && \
   [[ "$noq" =~ (\\\\|//[a-zA-Z0-9.-]+/|/p:PublishProfile|--output[[:space:]]+[A-Z]:|inetpub|wwwroot) ]]; then
  block "no publishing to a deployment target" \
        "'dotnet publish' to a UNC path or publish profile IS a deploy." \
        "Publish to a local ./publish directory instead."
fi

# --------------------------------------------------------------------------
# 4. Touching a non-local database
# --------------------------------------------------------------------------
if [[ "$noq" =~ (sqlcmd|Invoke-Sqlcmd|bcp|osql) ]] || \
   [[ "$noq" =~ dotnet[[:space:]]+ef[[:space:]]+database ]]; then
  if [[ ! "$noq" =~ (localhost|127\.0\.0\.1|\(localdb\)|tcp:localhost) ]] || \
     [[ "$noq" =~ (prod|production|-prod|PROD) ]]; then
    block "no database commands outside localhost" \
          "A migration or script against a shared/production database is unrecoverable from here." \
          "Point it at localhost, or hand the script to a DBA."
  fi
fi

# --------------------------------------------------------------------------
# 5. Blunt filesystem destruction
# --------------------------------------------------------------------------
if [[ "$noq" =~ rm[[:space:]]+(-[a-zA-Z]*[rR][a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*[rR])[[:space:]]+(/|~|\$HOME|\*) ]] || \
   [[ "$noq" =~ git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*x ]]; then
  block "no recursive delete of a home or root path" \
        "Not recoverable." \
        "Delete a specific, named subdirectory instead."
fi

exit 0
