# Security & Privacy Policy

## What this project handles

- **Data classification: Public.** The game ships no secrets and has no backend.
- Player data (a nickname, a chosen look, save games, settings and an optional
  written reflection) is stored **only in the player's browser** (IndexedDB).
  Nothing is sent to a server. There are no accounts, ads, chat or
  user-generated content.
- Anonymous analytics are **off by default** and no provider is connected
  (see [docs/security-privacy.md](docs/security-privacy.md)).

If a change would make this repository handle data above "Public" — accounts,
emails, real names, cloud saves, AI calls with player text — stop and get a
human decision first. It is a product and privacy decision, not an
implementation detail.

## Reporting a problem

This is a family project. Report suspected vulnerabilities or content-integrity
problems privately to the repository owner (GitHub: open a *private* security
advisory under the repository's Security tab once it is hosted). Please do not
open a public issue for a vulnerability.

## If a secret is ever committed

1. Stop. Do not push.
2. Rotate the credential at its source immediately.
3. If it was pushed, treat the history as compromised: rotate first, then clean.
4. Add the leak's pattern to `SECRET_RE` in `scripts/lib/policy.sh` so the
   pre-commit hook and `quality-sweep.sh` catch it next time.

Remember: every `VITE_*` variable is compiled into the public JavaScript
bundle. Never put a key, token or password in one (`quality-sweep.sh` checks).

## Sensitive paths (human approval required)

The authoritative list is `SENSITIVE_PATH_PATTERNS` in
`scripts/lib/policy.sh`. Editing those files prompts for approval in Claude
Code, and committing them requires a `SECURITY-REVIEW: <approver>` commit
trailer (enforced by `scripts/hooks/commit-msg`). That list includes
`src/content/scripture/translations.ts`, because enabling displayed Bible text
is an editorial decision a named person must own.

## Agent-generated changes

AI agents working in this repo follow [AGENTS.md](AGENTS.md). Agents must never
add a `SECURITY-REVIEW:` trailer on their own authority, never disable hooks
(`--no-verify`), and never deploy — deployment workflows are manual and
main-only.
