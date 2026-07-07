# The Loop — a reusable closed-loop dev harness

Six global sub-agents (`~/.claude/agents/*.md`) that split **problem validation**, **generation**,
**verification**, and **human hand-off**, and feed each other. This file is the operator's guide: how
they wire together, the memory spine that makes it a *loop* and not a one-shot, and the Claude Code
harness tips baked in.

> Loop engineering = you stop prompting the agent turn-by-turn and instead design the system that
> prompts it. These six are block #5 (sub-agents) of that system. The memory spine below is block #6.

## The loop

```
调研证伪 requirement-scout ─spec─▶ 方案 plan-author ─plan─▶ 对抗评审 architect ─VERDICT─▶ 执行 implementer ─▶ 真跑验证 tester
        │ (gated: novel/greenfield)     ▲                     ▲  │                          │                     │
        │ KILL → 停(连 plan 都不排)       │ REVISE (设计错)      │  │ rebuttal (你裁决)          │ diff + commits      │
        ▼                               └─────────────────────┘  └── "根子是需求错了" ◀──────┴── FAIL / irreversible / PASS
      (停)                                                       (回灌终点是 scout,不是 planner)          │
                                                                                                    PASS ▼
                                                                                          验收简报 review-briefer
                                                                                      (讲人话，不裁决，不是第七个verdict)
                                                                                                          │
                                                                                                          ▼
                                                                                              你：5秒验收checkpoint
```

The **feedback edges** are what close the loop — without them it's just a pipeline:

- **requirement-scout is gated** — only runs when the requirement is novel / greenfield / uncertain; its **KILL** verdict stops a pointless build *before any planning or code* (the cheapest bug to fix is the feature you never build).
- **architect ↔ planner** — `REVISE` bounces the plan back; you adjudicate the rebuttal.
- **tester → implementer** (code bug) / **→ planner** (design wrong) / **→ requirement-scout** (the root cause is a *wrong requirement*).
- **irreversible → ROLLBACK**. And **tester PASS is not the finish line** — it means "built to spec", not "achieves the effect you wanted". So the real close is a **5-second acceptance checkpoint — you, not an agent**: PASS → you eyeball it → **accept** (write memory, done) **or reject** → route by *why*: wrong effect because the need/criteria were wrong → **scout** (REFRAME); right need but bad approach → **planner**. This is deliberately a human judgment, NOT a stage with its own verdict (see Right-size it).
- **tester → review-briefer** (optional, on PASS) — if the diff isn't self-explanatory to you yet, review-briefer turns it into a plain-language brief *before* your checkpoint. It hands you material, not a ruling — the accept/reject call above is still 100% yours.

## The six roles

| Role | File | Fires when | Can mutate source? |
|---|---|---|---|
| 调研证伪 / scout | `requirement-scout.md` | **gated** — only when the requirement is novel/greenfield/uncertain; validate WHAT & WHY before any planning | no (research only) |
| 方案 / planner | `plan-author.md` | start of any non-trivial task; or to REVISE after objections/failures | no (read-only) |
| 对抗评审 / architect | `adversarial-architect.md` | after a plan exists, before code — falsify it (8-angle attack) | no (read-only) |
| 执行 / implementer | `surgical-implementer.md` | only after adjudication settles the design | **yes** |
| 真跑验证 / tester | `runtime-verifier.md` | after implementation lands — *runs* it, PASS/FAIL/INCONCLUSIVE | no (scratch only) |
| 验收简报 / review-briefer | `review-briefer.md` | **optional, after tester PASS**, right before your acceptance checkpoint — translates the settled diff + test evidence into a plain-language brief for someone who doesn't yet read code fluently | no (read-only, no verdict) |

**Models:** the **scout** and **architect** run on **opus** — both do hard adversarial / first-principles
reasoning where a strong checker earns its cost. The **implementer** runs on **sonnet** (execution needs
care and bug-spotting, not peak reasoning — cheaper and faster). Planner, tester, and review-briefer
inherit the session model — plain summarization/translation doesn't need the adversarial tier either.
This is the article's "different model for the checker" — plus a cheaper model for the mechanical work.

Note the **scout plays by a different grounding standard** than the code-side agents: it can't cite
`file:line`, so it must cite **sources**, separate **verified from assumed**, and state **confidence** —
the guard against a confident-but-hallucinated market claim producing a validated-*sounding* fake requirement.

## Right-size it — the loop is a template you subset from, not an assembly line

None of the five stages is *useless* — each is one of three irreducible operations: **decide** what/whether
(scout, planner) · **build** (implementer) · **check** (architect, tester, + the acceptance checkpoint). But
you almost never run all of them. The gates exist to keep the common path short — run the **fewest stages the
task's blast radius justifies**:

| Task | Stages you actually run |
|---|---|
| Trivial one-liner, no blast radius | just do the edit — **0 agents** |
| Ordinary feature / fix | planner → implementer → tester — **3** |
| Risky / complex / wide blast radius | + adversarial-architect — **4** |
| Novel / greenfield / requirement in doubt | + requirement-scout at the front — **5** |
| Outcome still in doubt after it's built | + the acceptance checkpoint (you) at the end |
| You can't yet read the diff fluently enough to run that checkpoint yourself | + review-briefer, right before the checkpoint |

If the loop ever *feels* long, you're looking at its **maximal** form — subset it. ~90% of work is the
3-stage path. Adding a stage is a deliberate response to risk, never a ritual. review-briefer is the one
exception worth defaulting to **on** rather than gating by risk: it's cheap, it never blocks the loop, and
if you're still building fluency, skipping it just re-creates the comprehension debt the loop exists to
avoid (see "Stay the engineer" below).

## How to run it

**Manual mode** (start here — you stay in the loop, low cost): if the requirement itself is uncertain
or greenfield, start one step earlier with `requirement-scout` — a **KILL** verdict means you're done,
you just saved yourself from building the wrong thing. Otherwise start at `plan-author`, hand its plan to
`adversarial-architect`, adjudicate the objections yourself, hand the settled plan to `surgical-implementer`,
then `runtime-verifier`. On PASS, invoke `review-briefer` before you do your own accept/reject pass — it
costs one cheap agent call and turns the diff into something you can actually read and learn from. You are
the orchestrator and the adjudicator — the single human checkpoint the article insists you keep.

**Workflow mode** (once the flow is trustworthy): a deterministic script wires plan→review→
(loop until PROCEED)→implement→verify→(loop until PASS), so you design it once and press go.

The two verdict lines are **machine-routable on purpose** — `VERDICT: PROCEED|REVISE|REJECT` and
`PASS|FAIL|INCONCLUSIVE` — so a script can branch on them without parsing prose.

## Memory spine (block #6) — the reason tomorrow's run isn't amnesiac

The model forgets everything between runs; the disk doesn't. `LOOP-STATE.md` at the project root
(nearest ancestor with `.git`, or the working dir if there's none) is that disk. **This is wired into all
six agent files, not just a suggestion** — every agent reads it before it starts and (if it learned
something durable) persists to it before it finishes:

```markdown
# LOOP-STATE — <project>
## Goal
<the standing objective the loop is driving toward>
## Done
- <finding/step> — <verified how>
## In progress
- <current stage + which agent holds it + open finding IDs (F1, F2…)>
## Next
- <the next thing to pick up>
## Decisions / rejected paths
- <what we tried, what the architect killed and why — so we don't relitigate>
## Pitfalls / gotchas
- <what tripped us up on THIS project — a wrong assumption, a build quirk, a flaky check, a
  false-green trap — and what to do instead. Read this section first; it's the whole point.>
```

**Who writes it, and how:**

- `surgical-implementer` and `runtime-verifier` have `Write` and persist directly (read the file, append
  the relevant section, write it back). `runtime-verifier` is the natural closer — it updates `Done`/
  `Next` and logs anything a false-green guard actually caught.
- `requirement-scout`, `plan-author`, and `adversarial-architect` are deliberately **read-only** (no
  `Write` tool — that's a maker/checker safety boundary, not an oversight) so they don't persist directly.
  Instead they emit a `LOOP-STATE APPEND:` block in their output (before any strict last-line verdict, never
  after) and **you, the orchestrator, persist it** — one copy-paste, not a tool grant that would blur their
  read-only guarantee.
- `review-briefer` reads it for context (e.g. "this diff resolved a previously-logged pitfall") but never
  writes — it doesn't discover anything new, it translates already-settled work.

**Scope discipline — this is project-local, and promotion to global memory is human-only, on purpose.**
No agent promotes a `LOOP-STATE.md` entry to Claude Code's global/cross-project memory itself. Every
agent's instructions say the same thing: if a finding seems to matter beyond this one repo, surface it as
a one-line aside and let the human decide whether it's real signal or a one-off. This is a deliberate
brake — letting agents freely generalize "lessons" across projects is exactly how you get the generic,
stale, unearned "best practices" boilerplate this loop bans everywhere else (see the architect's banned-
findings list, the tester's grounding rule). A pitfall worth remembering forever should survive a human
actually reading it once.

`LOOP-STATE.md` is disposable bookkeeping, not a deliverable — worth adding to `.gitignore` in most repos
so it doesn't clutter the actual project history; it only needs to survive on the local disk between runs.

Claude Code already ships a refined version of the *cross-project* half of this idea
(`~/.claude/projects/<project>/memory/` = one fact per file + a `MEMORY.md` index with a `description`
for recall). Use it for facts that outlive one project, promoted there by a human, not an agent; use
`LOOP-STATE.md` for the live per-project loop state.

## Claude Code harness tips folded in (standing on giants' shoulders)

These are patterns from Claude Code's own design, and where each one lives in the loop:

1. **State on disk, indexed for recall** (CC memory: one-fact files + `MEMORY.md`) → the `LOOP-STATE.md` spine above.
2. **Ground every claim in file:line + a concrete failure scenario; ban generic boilerplate** (CC `/code-review`, ReportFindings) → architect's evidence standard + tester's grounding rule.
3. **Verify by driving the real flow, not tests-only** (CC `/verify`: "ship code you confirmed works") → tester's prime directive: no PASS without a command that produced it.
4. **Maker ≠ checker** (CC subagents + adversarial review) → architect and tester are strictly non-mutating; they cannot grade their own homework.
5. **Smallest diff, match surrounding idiom, prefer edit over create** (CC coding discipline) → implementer.
6. **Front-load decisions once (plan mode); don't ask mid-run** → planner does the deciding up front, which is also how you kill the human-in-the-loop friction.
7. **Externalize multi-step progress (TodoWrite)** → every agent keeps a ledger so re-runs are targeted, not from-scratch.
8. **Confirm before hard-to-reverse / outward-facing actions; approval doesn't carry across contexts** → implementer STOPS on irreversible steps; tester escalates + recommends rollback.
9. **Report outcomes faithfully — tests fail, say so; never claim done unverified** → tester's three-valued verdict (INCONCLUSIVE is not a courtesy PASS).
10. **Structured, schema-forced hand-offs** → the machine-routable verdict lines.
11. **Isolation for parallel (worktrees) · permission modes + allowlist to cut prompts · hooks for deterministic lifecycle** → the plumbing (see below).

## Still to add when you open a real project (blocks #1, #2, #4)

Global-reusable core (#5 agents, #6 memory convention, the tips above) is done. These attach to a repo:

- **#1 Heartbeat** — make it a *loop*, not a run: `/loop` (interval / self-paced in-session) or `/schedule` (cloud cron, survives closing the laptop), or lifecycle `hooks` (e.g. PostToolUse → run tests / auto-commit).
- **#2 Worktrees** — parallel isolation so two agents don't collide: `git worktree`, or `isolation: worktree` on a sub-agent (surgical-implementer already uses the EnterWorktree/ExitWorktree tools for this).
- **#4 Connectors** — MCP servers so the loop touches your real tools (issue tracker, DB, Slack, staging API) and can open the PR + update the ticket itself.
- **Per-project weighting** — a thin line in the project's `CLAUDE.md` re-weights the architect's 8 angles (e.g. "payments system: correctness + reversibility over speed") without forking the global agent.

## Stay the engineer

The loop changes the work, it doesn't delete you from it. Verification is still yours; comprehension
debt grows faster the smoother the loop runs; the comfortable posture (take whatever it gives back) is
the risky one. Design the loop to go faster on work you understand — not to avoid understanding it.
`review-briefer` exists for exactly this: it doesn't lower the bar for what you need to understand, it
lowers the cost of understanding it — a plain-language ramp onto the diff for whenever you're not yet
fluent enough to read it cold.
