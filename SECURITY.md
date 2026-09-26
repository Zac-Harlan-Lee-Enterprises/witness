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

## Editorial decisions

Enabling displayed Bible text (`src/content/scripture/translations.ts`) and
approving educational content are editorial decisions a named person must own
(see [docs/content-governance.md](docs/content-governance.md)). Tests assert
that no record approves itself and that the translation is off by default.

## Agent-generated changes

AI agents working in this repo follow [AGENTS.md](AGENTS.md). The owner runs
it without approval gates: agents may push, merge pull requests and run
workflows, and the site deploys automatically once CI passes on `main`.
Agents never disable hooks (`--no-verify`), force-push or rewrite history.
