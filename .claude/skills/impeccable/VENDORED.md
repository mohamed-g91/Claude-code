# Provenance

This is the Impeccable design skill, vendored — not written for this repo.

- Upstream: https://github.com/pbakaus/impeccable (Apache 2.0, see `LICENSE` / `NOTICE.md`)
- Vendored from `plugin/skills/impeccable` at commit `4db7f6b`
- Copied, not generated. Do not hand-edit anything in this folder; changes are
  lost on the next update.

## Why vendored rather than installed

The supported install is `npx impeccable install --providers=claude
--scope=project`. Its engine binary pins its own root certificates and cannot
complete TLS through this sandbox's HTTPS proxy, so the download step fails.
The upstream README's copy-from-repository path (Option 5) produces the same
skill folder, which is what is checked in here.

## Updating

```
git clone --depth 1 https://github.com/pbakaus/impeccable /tmp/impeccable
rm -rf .claude/skills/impeccable
cp -r /tmp/impeccable/plugin/skills/impeccable .claude/skills/impeccable
cp /tmp/impeccable/plugin/agents/*.md .claude/agents/
cp /tmp/impeccable/LICENSE /tmp/impeccable/NOTICE.md .claude/skills/impeccable/
```

On a machine with ordinary network access, `npx impeccable update` is the
better route.

## The launcher

`scripts/impeccable context` works: it fetched engine 0.1.3 into
`~/.impeccable/bin/` on first run and resolves context normally. Only the
installer's skill-bundle download hits the TLS wall, which is why the folder
is vendored rather than installed.

The engine lives outside the repo, so a fresh clone downloads it again on the
first `impeccable` call.
