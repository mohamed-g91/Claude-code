# Provenance — dsh-delegate

This skill is **not** installed from a released `delegate-skills` package. It is vendored from an
**open, unmerged pull request**, so `skills-lock.json` does not track it and `npx skills update`
will not update it.

| | |
| --- | --- |
| Upstream | [amElnagdy/delegate-skills](https://github.com/amElnagdy/delegate-skills) |
| Source | [PR #95 — "feat: add dsh-delegate (DeepSeek Harness) with session-record harvest"](https://github.com/amElnagdy/delegate-skills/pull/95) |
| Commit | `0c600c904ab69594a989fc7862f1ece66027938b` |
| Author | Aymen Bouferroum |
| Claim issue | [#93 — claim: dsh-delegate](https://github.com/amElnagdy/delegate-skills/issues/93) (opened by AbdullahElTiby) |
| Vendored on | 2026-09-06 |

## Why this PR and not the other

Two open PRs implement `dsh-delegate`. Under the upstream tie-break rule, whichever satisfies the
merge checklist better lands, and the other's distinct improvements get pulled in and credited.

- **[#95](https://github.com/amElnagdy/delegate-skills/pull/95)** (vendored here) — verified live on
  **Linux** against dsh 0.1.1-rc.1 and a real **local** inference server (vLLM), which is the case
  this repo needs. Adds a session-record harvest recovering data the headless surface never prints.
- **[#94](https://github.com/amElnagdy/delegate-skills/pull/94)** — verified live on **Windows 11**
  against dsh 0.1.0-rc.7; its POSIX path was reasoned rather than executed. Prefer it on Windows.

## What else was applied

PR #95 also registers `dsh` as a fleet-lane implementer. Those two hunks were applied to the
installed `delegate-setup` copies, which otherwise matched upstream `master` exactly:

- `.claude/skills/delegate-setup/scripts/implementers.mjs` — the `dsh` registry entry and
  `DSH_PERMISSION`.
- `.claude/skills/delegate-setup/scripts/config.mjs` — lane validation for the dsh dials.

Re-running `npx skills add amElnagdy/delegate-skills` will overwrite those two files and drop the
`dsh` lane registration. Re-apply from the PR if that happens.

## Review performed before vendoring

`scripts/relay.mjs` was read: Node built-ins only, no network calls, no credential reads, no
telemetry, and no git write verbs anywhere (it never commits). It shells out only to `dsh` and
`git`, and inherits the environment so `dsh` authenticates exactly as it does at your terminal. The
session harvest reads only local records under `$DSH_HOME/sessions` and extracts scalars — session
id, provider/model, token counts, permission preset — never conversation content.

Contract paths verified in a container **without** `dsh` installed:

| Path | Expected | Result |
| --- | --- | --- |
| `--help` | exit 0 | pass |
| empty brief | exit 2, no `result.json` | pass |
| unknown flag | exit 2 | pass |
| invalid `--permission-mode` | exit 2 before dispatch | pass |
| `dsh` missing | exit 127 **with** `result.json`, status `dsh_unavailable` | pass |
| unknown `--lane` | fails loud | pass |

**Not verified here:** any real dispatch. That needs `dsh` installed and a provider configured, on
your own machine. Treat the first live run as the real test.
