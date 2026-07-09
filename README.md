# junior-go

English | [中文](README.zh-CN.md)

A portable Claude Code global config: `CLAUDE.md` + `settings.json` + a **six-agent closed-loop dev
harness** (`agents/`) that turns "prompt the agent and hope" into a repeatable system with adversarial
review, real-run verification, and a plain-language, growth-tracked explanation built in.

## Who this is for

This loop is built around one specific reader: **a junior engineer using Claude Code to build real
things, who wants to get stronger while doing it — not just collect code that happens to run.**

That constraint shapes every design choice here:

- **Guardrails stand in for experience you don't have yet.** `adversarial-architect` falsifies the plan
  before any code exists; `runtime-verifier` proves the result actually works instead of asking you to
  trust a diff. Neither requires you to already know what a bad plan or a subtly wrong change looks like —
  that's the point.
- **The human checkpoint is never automated away.** A `PASS` from the tester means "built to spec," not
  "you understood what changed." The loop's last stop before you is always a human decision, not an agent's.
- **`junior-explainer` exists specifically because a `PASS` verdict and a raw diff aren't enough for
  someone who can't yet read code fluently.** It translates the settled change into plain language — one-
  sentence goal, every changed file with a reason, the 3-5 core functions before-vs-after, what was
  actually tested vs. not, and the handful of lines most worth your own eyes — so accepting the change is
  an informed call, not a rubber stamp. It also proposes an update to a persistent, project-local
  `memory/junior/` growth record, so next round's explanation builds on what you were already shown
  instead of starting from zero every session.
- **The loop is meant to shrink as you grow.** It's a template you subset from, not an assembly line you
  run end-to-end forever (see "Right-size it" in `agents/LOOP.md`). Catching yourself skipping stages more
  often over time isn't cutting corners — it's the loop working as intended, because your own judgment is
  covering ground the agents used to have to. `memory/junior/growth-map.yaml` is where that progress gets
  written down, not just felt.

## What's in here

- **`agents/*.md`** — six global sub-agents forming the loop, plus `agents/LOOP.md`, the operator's guide:
  how the six roles wire together and hand off, the feedback edges that make it a *loop* and not a
  pipeline, the memory spine that survives between sessions, and when to run 0 stages vs. all 6.
- **`CLAUDE.md`** — a couple of generic personal preferences (reply language, mainly). Not loop-specific.
- **`settings.json`** — personal editor/model/plugin settings. This one is closer to a dotfile than a
  system: don't copy it blindly, merge the parts you actually want (see Install below).
- **`LOOP-STATE.md` (project-local, not in this repo)** — created at each project root by the loop's
  agents during a run. It's project-local bookkeeping: every agent reads `## Pitfalls / gotchas` and `##
  Decisions / rejected paths` at start (so the loop doesn't re-hit the same traps), and `runtime-verifier`
  + `surgical-implementer` append findings to it as they discover durable, project-specific facts. See
  `agents/LOOP.md` § "Memory spine" for the full contract. Recommend adding `LOOP-STATE.md` to
  `.gitignore` — it's ephemeral working memory, not part of the actual codebase.
- **`memory/junior/` (project-local, not in this repo)** — a second, parallel memory spine owned by
  `junior-explainer`: what the junior operator has been shown, with evidence, and how their understanding
  is growing across frontend/backend/database/testing/workflow. It never feeds back into the engineering
  agents — it only shapes how the next explanation is written. Full schema in `agents/junior-explainer.md`;
  contract summary in `agents/LOOP.md` § "Junior memory spine".

## The six roles

| Role | File | Fires when | Can mutate source? |
|---|---|---|---|
| 调研证伪 / scout | `requirement-scout.md` | gated — only when the requirement is novel/greenfield/uncertain | no (research only) |
| 方案 / planner | `plan-author.md` | start of any non-trivial task; or to revise after objections/failures | no (read-only) |
| 对抗评审 / architect | `adversarial-architect.md` | after a plan exists, before any code — falsifies it | no (read-only) |
| 执行 / implementer | `surgical-implementer.md` | only after the design is adjudicated | **yes** |
| 真跑验证 / tester | `runtime-verifier.md` | after implementation lands — runs it for real, PASS/FAIL/INCONCLUSIVE | no (scratch only) |
| 讲解+成长记录 / junior-explainer | `junior-explainer.md` | after tester PASS, right before you decide | no (read-only) |

Every role's `tools:` frontmatter is the actual enforcement mechanism, not a suggestion — Claude Code
blocks a call to a tool that isn't granted. That's why `plan-author`, `adversarial-architect`, and
`junior-explainer` have no `Edit`/`Write` in their frontmatter at all: they *cannot* touch source, not just
"are asked not to." Only `surgical-implementer` can. See "Why this isn't a Skill" below for why that
matters enough to shape the whole repo layout.

Full mechanics, the loop diagram, the "how much of this do I actually need" table, and the memory
convention all live in [`agents/LOOP.md`](agents/LOOP.md) — read that before your first real run.

## Why this isn't a Skill

Claude Code Skills and Claude Code sub-agents solve different problems, and this repo deliberately stays
on the sub-agent side of that line.

A Skill is instructions loaded into the *current* model's context. Anything it wants another role to do,
it does through the same Agent tool anyone else can call — including asking for a `general-purpose` agent
and pasting a role's instructions into the prompt. That gets you a fresh context and even a chosen model,
but **not** a hard tool boundary: a `general-purpose` agent has full tool access, so "don't call `Edit`"
becomes something the prompt asks for, not something the harness enforces. A subtle drift, a long context,
or an injected instruction can talk it into using a tool it was only ever asked nicely not to use.

A registered sub-agent (`agents/*.md`, installed under `~/.claude/agents/`) gets its tool list checked by
Claude Code itself, before the call ever reaches the model. `plan-author` cannot call `Edit` — the
permission layer refuses it — regardless of what's in its context or what any prompt says. That is the
actual mechanism behind every "planner/architect/reviewer can't touch code, only the implementer can"
claim in this README. Collapsing the six roles into one Skill would trade that hard boundary for a soft
one, silently, the first time someone installed this project a slightly different way.

So the split stays: `agents/` carries the maker/checker guarantee that matters, `skills/dev-loop-orchestrator`
is a thin *orchestration* layer that teaches the acting model when to call which registered agent and how
to route PROCEED/REVISE/REJECT, PROCEED/REFRAME/KILL, and PASS/FAIL/INCONCLUSIVE — it never re-implements
a role's behavior inline. If you only take one thing from this section: **install via the plugin
(below), don't hand-copy `agents/`, don't fold the roles into a single skill file** — any of those
quietly turns a mechanical guarantee into a hopeful one.

## Install

### Option A — Install as a Claude Code Plugin (recommended)

This repo self-hosts its own marketplace: a `.claude-plugin/marketplace.json` at the repo root that points
its single plugin entry at `./`. Installing this way pulls in `agents/` *and* `skills/` as a real plugin
install, with no file copying and — crucially — no self-modification prompt (see the gotcha under Option B
for why that matters).

**Slash-command flow**, inside a Claude Code session:

```
/plugin marketplace add wangfugui66/junior-go
/plugin install junior-go@junior-go
```

**Or the `settings.json` flow** — add both blocks below. This mirrors exactly how a plugin like
`andrej-karpathy-skills` (from GitHub repo `forrestchang/andrej-karpathy-skills`) is wired up:

```json
{
  "enabledPlugins": {
    "junior-go@junior-go": true
  },
  "extraKnownMarketplaces": {
    "junior-go": {
      "source": {
        "source": "github",
        "repo": "wangfugui66/junior-go"
      }
    }
  }
}
```

Either path gives you the six agents and the skills without ever writing to `~/.claude/agents/` by hand.

### Option B — Manual copy (CLAUDE.md + settings.json only)

`agents/` and `skills/` are now covered by the plugin install above and no longer need manual copying —
what's left here is just the two personal-config files:

```powershell
git clone https://github.com/wangfugui66/junior-go.git
Copy-Item junior-go\CLAUDE.md "$env:USERPROFILE\.claude\CLAUDE.md"
# settings.json: merge by hand, don't overwrite — it's personal and drifts per machine on purpose
```

(macOS/Linux: same idea, target `~/.claude/` instead of `$env:USERPROFILE\.claude`.)

**Gotcha worth knowing:** Claude Code's own safety layer treats writes to `~/.claude/CLAUDE.md` and
`~/.claude/agents/` as *self-modification* — an agent changing its own global behavior/authority — and may
block itself from doing this install for you, even after you've explicitly approved it in chat. Manually
copying `agents/` is exactly what used to trigger this block; Option A sidesteps it entirely, since the
plugin manager does the write instead of the agent editing its own global files. That's intentional, not a
bug: an agent shouldn't be able to grant itself new global capability on its own say-so. If it happens on
the remaining `CLAUDE.md` copy, run it yourself from a plain terminal, or use `/permissions` to allow it
going forward.

## Quick start

For an ordinary feature or fix: `plan-author` → adjudicate `adversarial-architect`'s objections yourself →
`surgical-implementer` → `runtime-verifier` → on PASS, `junior-explainer` (plain-language explanation +
a `memory/junior/` update proposal you apply yourself) → you make the actual accept/reject call. Start one
step earlier with `requirement-scout` if the requirement itself is still in doubt. Skip straight to just
editing the file if it's a trivial, no-blast-radius change — see `agents/LOOP.md` § "Right-size it" for the
full sizing guide.
