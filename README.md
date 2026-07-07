# claude-harness

English | [中文](README.zh-CN.md)

A portable Claude Code global config: `CLAUDE.md` + `settings.json` + a **six-agent closed-harness dev
harness** (`agents/`) that turns "prompt the agent and hope" into a repeatable system with adversarial
review, real-run verification, and a plain-language brief built in.

## Who this is for

This harness is built around one specific reader: **a junior engineer using Claude Code to build real
things, who wants to get stronger while doing it — not just collect code that happens to run.**

That constraint shapes every design choice here:

- **Guardrails stand in for experience you don't have yet.** `adversarial-architect` falsifies the plan
  before any code exists; `runtime-verifier` proves the result actually works instead of asking you to
  trust a diff. Neither requires you to already know what a bad plan or a subtly wrong change looks like —
  that's the point.
- **The human checkpoint is never automated away.** A `PASS` from the tester means "built to spec," not
  "you understood what changed." The harness's last stop before you is always a human decision, not an agent's.
- **`review-briefer` exists specifically because a `PASS` verdict and a raw diff aren't enough for someone
  who can't yet read code fluently.** It translates the settled change into plain language — one-sentence
  goal, every changed file with a reason, the 3-5 core functions before-vs-after, what was actually tested
  vs. not, and the handful of lines most worth your own eyes — so accepting the change is an informed call,
  not a rubber stamp.
- **The harness is meant to shrink as you grow.** It's a template you subset from, not an assembly line you
  run end-to-end forever (see "Right-size it" in `agents/harness.md`). Catching yourself skipping stages more
  often over time isn't cutting corners — it's the harness working as intended, because your own judgment is
  covering ground the agents used to have to.

## What's in here

- **`agents/*.md`** — six global sub-agents forming the harness, plus `agents/LOOP.md`, the operator's guide:
  how the six roles wire together and hand off, the feedback edges that make it a *harness* and not a
  pipeline, the memory spine that survives between sessions, and when to run 0 stages vs. all 6.
- **`CLAUDE.md`** — a couple of generic personal preferences (reply language, mainly). Not harness-specific.
- **`settings.json`** — personal editor/model/plugin settings. This one is closer to a dotfile than a
  system: don't copy it blindly, merge the parts you actually want (see Install below).
- **`LOOP-STATE.md` (project-local, not in this repo)** — created at each project root by the harness
  agents during a run. It's project-local bookkeeping: every agent reads `## Pitfalls / gotchas` and `##
  Decisions / rejected paths` at start (so the loop doesn't re-hit the same traps), and `runtime-verifier`
  + `surgical-implementer` append findings to it as they discover durable, project-specific facts. See
  `agents/LOOP.md` § "Memory spine" for the full contract. Recommend adding `LOOP-STATE.md` to
  `.gitignore` — it's ephemeral working memory, not part of the actual codebase.

## The six roles

| Role | File | Fires when | Can mutate source? |
|---|---|---|---|
| 调研证伪 / scout | `requirement-scout.md` | gated — only when the requirement is novel/greenfield/uncertain | no (research only) |
| 方案 / planner | `plan-author.md` | start of any non-trivial task; or to revise after objections/failures | no (read-only) |
| 对抗评审 / architect | `adversarial-architect.md` | after a plan exists, before any code — falsifies it | no (read-only) |
| 执行 / implementer | `surgical-implementer.md` | only after the design is adjudicated | **yes** |
| 真跑验证 / tester | `runtime-verifier.md` | after implementation lands — runs it for real, PASS/FAIL/INCONCLUSIVE | no (scratch only) |
| 验收简报 / review-briefer | `review-briefer.md` | after tester PASS, right before you decide | no (read-only) |

Full mechanics, the harness diagram, the "how much of this do I actually need" table, and the memory
convention all live in [`agents/LOOP.md`](agents/LOOP.md) — read that before your first real run.

## Install

```powershell
git clone https://github.com/wangfugui66/claude-loop-harness.git
Copy-Item claude-loop-harness\CLAUDE.md "$env:USERPROFILE\.claude\CLAUDE.md"
Copy-Item claude-loop-harness\agents "$env:USERPROFILE\.claude\agents" -Recurse
# settings.json: merge by hand, don't overwrite — it's personal and drifts per machine on purpose
```

(macOS/Linux: same idea, target `~/.claude/` instead of `$env:USERPROFILE\.claude`.)

**Gotcha worth knowing:** Claude Code's own safety layer treats writes to `~/.claude/CLAUDE.md` and
`~/.claude/agents/` as *self-modification* — an agent changing its own global behavior/authority — and may
block itself from doing this install for you, even after you've explicitly approved it in chat. That's
intentional, not a bug: an agent shouldn't be able to grant itself new global capability on its own say-so.
If it happens, run the copy yourself from a plain terminal, or use `/permissions` to allow it going
forward.

## Quick start

For an ordinary feature or fix: `plan-author` → adjudicate `adversarial-architect`'s objections yourself →
`surgical-implementer` → `runtime-verifier` → on PASS, `review-briefer` → you make the actual accept/reject
call. Start one step earlier with `requirement-scout` if the requirement itself is still in doubt. Skip
straight to just editing the file if it's a trivial, no-blast-radius change — see `agents/LOOP.md` § "Right-size it"
for the full sizing guide.
