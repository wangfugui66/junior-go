# AGENTS.md

This repository is a cross-harness package for the same closed-loop development system:

- Claude Code entry points: `CLAUDE.md`, `.claude-plugin/`, `agents/`, `skills/`, and `workflows/`.
- Codex entry points: `AGENTS.md`, `.codex-plugin/plugin.json`, and the same shared `skills/` directory.

When modifying this repo, keep the two harnesses compatible instead of replacing one with the other.

## Compatibility Rules

- Keep `CLAUDE.md` and `.claude-plugin/` working for Claude Code users.
- Keep `.codex-plugin/plugin.json` valid for Codex plugin ingestion.
- Keep shared behavior in `agents/`, `skills/`, `workflows/`, and `memory/`; do not fork the loop unless a harness truly needs different syntax.
- Do not collapse the six role files in `agents/*.md` into one skill. In Claude Code, their `tools:` frontmatter is a hard permission boundary.
- Be explicit in docs when a guarantee is harness-specific. Codex can use the orchestration skill and this repository's instructions, but Claude Code sub-agent permission enforcement is not automatically created merely by reading `agents/*.md` as ordinary Markdown.
- When changing installation or compatibility behavior, update both `README.md` and `README.zh-CN.md`.

## Working Style

- Prefer small, reversible edits.
- Validate manifest changes with the Codex plugin validator when available.
- For non-trivial behavior changes, run the loop at the smallest useful size: plan, implement, verify, then explain the diff for a junior engineer before final human acceptance.
