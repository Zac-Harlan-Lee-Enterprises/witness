# policy.sh — single source of truth for harness policy values.
#
# Sourced by: scripts/hooks/pre-commit, scripts/hooks/commit-msg,
# scripts/hooks/pre-push, scripts/hooks/guard-destructive-commands.sh,
# and quality-sweep.sh. Change a value HERE, never in a consumer.
#
# This file is itself a sensitive path (it configures the guardrails):
# changes require human approval + a SECURITY-REVIEW commit trailer.

# Branches that only change through a reviewed PR.
PROTECTED_BRANCHES_RE='(main|master|release(/[^[:space:]]*)?|production)'

# Paths whose modification requires recorded human approval (enforced by
# scripts/hooks/commit-msg; mirrored as ask rules in .claude/settings.json —
# quality-sweep.sh cross-checks the two).
#
# Project-specific: the Scripture translation registry is here because flipping
# `approvedForDisplay` publishes Bible text to players. That is an editorial
# decision a named human must own (docs/content-governance.md).
SENSITIVE_PATH_PATTERNS=(
  '^\.github/'
  '^infra/'
  '^deploy/'
  '^cdk/'
  '^terraform/'
  '^\.claude/settings\.json$'
  '^scripts/hooks/'
  '^scripts/lib/'
  '^CODEOWNERS$'
  '^src/content/scripture/translations\.ts$'
)

# Secret detection (pre-commit staged scan + quality-sweep repo scan).
SECRET_RE='(AKIA[0-9A-Z]{16}'
SECRET_RE+='|xox[baprs]-[A-Za-z0-9-]{10,}'
SECRET_RE+='|gh[pousr]_[A-Za-z0-9]{36,}'
SECRET_RE+='|github_pat_[A-Za-z0-9_]{22,}'
SECRET_RE+='|-----BEGIN [A-Z ]*PRIVATE KEY-----'
SECRET_RE+='|AccountKey=[A-Za-z0-9+/]{86}=='
SECRET_RE+='|[Pp]assword=[^;"'"'"'[:space:]]{8,};'
SECRET_RE+='|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}'
SECRET_RE+='|sk-[A-Za-z0-9]{32,}'
SECRET_RE+='|sk-ant-[A-Za-z0-9_-]{20,})'
