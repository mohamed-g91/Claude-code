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

Re-vendor with:

    git clone --depth 1 https://github.com/amElnagdy/delegate-skills /tmp/delegate-skills
    rm -rf .claude/skills/*-delegate .claude/skills/delegate-setup
    cp -r /tmp/delegate-skills/skills/. .claude/skills/
