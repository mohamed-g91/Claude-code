# Skills

Vendored from [amElnagdy/delegate-skills](https://github.com/amElnagdy/delegate-skills), MIT
licensed — see `LICENSE`. They live here rather than in `~/.claude/skills/` so they load in every
session on this repository, including Claude Code on the web, which starts from a fresh container
with only this repo checked out.

## What they need to actually run

Each `*-delegate` skill shells out to an implementer CLI that must already be **installed and
authenticated on the machine running the session** — `codex-delegate` needs the `codex` CLI,
`cursor-delegate` needs `cursor-agent`, and so on. The skills do not install or bundle those CLIs.

That makes them work on a local machine with the CLI installed, and not work in a cloud session,
where the container has none of them and the egress proxy denies unallowlisted hosts. Loading the
skill always succeeds; only the dispatch step depends on the environment.

## dsh-delegate is not from master

`dsh-delegate` (DeepSeek Harness) is not in the upstream default branch. It comes from
[PR #95](https://github.com/amElnagdy/delegate-skills/pull/95), which supersedes
[#94](https://github.com/amElnagdy/delegate-skills/pull/94) — same feature, then a review pass that
rewrote most of it. Being unmerged, it can still change or be rejected upstream. Re-vendoring from
master alone will silently drop it, so it is fetched separately below.

It needs the `dsh` CLI (`npm i -g @deepseek-ai/dsh`) and a provider credential —
`DEEPSEEK_API_KEY`, or any provider in `$DSH_HOME/settings.yaml`, including a local
OpenAI-compatible endpoint. In a cloud session npm is reachable and the package installs, but
`api.deepseek.com` is denied by the egress proxy (403 at CONNECT), so dispatch fails at the API
call rather than at install. DeepSeek Harness is in developer preview and its own README promises
compatibility-breaking changes.

## Re-vendoring

    git clone --depth 1 https://github.com/amElnagdy/delegate-skills /tmp/delegate-skills
    rm -rf .claude/skills/*-delegate .claude/skills/delegate-setup
    cp -r /tmp/delegate-skills/skills/. .claude/skills/

    # dsh-delegate separately, until PR #95 merges
    git -C /tmp/delegate-skills fetch origin refs/pull/95/head:pr95
    git -C /tmp/delegate-skills archive pr95 skills/dsh-delegate | tar -x -C /tmp/dsh
    cp -r /tmp/dsh/skills/dsh-delegate .claude/skills/
