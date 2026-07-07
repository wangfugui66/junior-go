# The Loop — a reusable closed-loop dev harness

Six global sub-agents (`~/.claude/agents/*.md`) that split **problem validation**, **generation**,
**verification**, and **translation-for-review**, and feed each other. This file is the operator's guide:
how they wire together, the memory spine that makes it a *loop* and not a one-shot, and the Claude Code
harness tips baked in.

> Loop engineering = you stop prompting the agent turn-by-turn and instead design the system that
> prompts it. These six are block #5 (sub-agents) of that system. The memory spine below is block #6.

## The loop

```
调研证伪 requirement-scout ─spec─▶ 方案 plan-author ─plan─▶ 对抗评审 architect ─VERDICT─▶ 执行 implementer ─▶ 真跑验证 tester
        │ (gated: novel/greenfield)     ▲                     ▲  │                          │                     │
        │ KILL → 停(连 plan 都不排)       │ REVISE (设计错)      │  │ rebuttal (你裁决)          │ diff + commits      │
        ▼                               └─────────────────────┘  └── "根子是需求错了" ◀──────┴── FAIL / irreversible
      (停)                                                       (回灌终点是 scout,不是 planner)      │
                                                                                                    PASS / INCONCLUSIVE
                                                                                                        │
                                                                                                        ▼
                                                                                        验收简报 review-briefer
                                                                                                        │ 讲人话的 brief
                                                                                                        ▼
                                                                                              人（5秒验收）
                                                                                          accept / reject → 路由回 scout 或 planner
```

The **feedback edges** are what close the loop — without them it's just a pipeline:

- **requirement-scout is gated** — only runs when the requirement is novel / greenfield / uncertain; its **KILL** verdict stops a pointless build *before any planning or code* (the cheapest bug to fix is the feature you never build).
- **architect ↔ planner** — `REVISE` bounces the plan back; you adjudicate the rebuttal.
- **tester → implementer** (code bug) / **→ planner** (design wrong) / **→ requirement-scout** (the root cause is a *wrong requirement*).
- **irreversible → ROLLBACK**. And **tester PASS is not the finish line** — it means "built to spec", not "achieves the effect you wanted". Before you judge that, **review-briefer** turns the settled diff + the verifier's evidence into a plain-language brief — so the close is a **5-second acceptance checkpoint — you, not an agent**, made with an actual understanding of what changed, not a rubber stamp on a PASS you couldn't read. PASS (brief in hand) → you eyeball it → **accept** (write memory, done) **or reject** → route by *why*: wrong effect because the need/criteria were wrong → **scout** (REFRAME); right need but bad approach → **planner**. The checkpoint is deliberately a human judgment, NOT an agent's call (see Right-size it) — review-briefer informs it, it doesn't make it.

## The six roles

| Role | File | Fires when | Can mutate source? |
|---|---|---|---|
| 调研证伪 / scout | `requirement-scout.md` | **gated** — only when the requirement is novel/greenfield/uncertain; validate WHAT & WHY before any planning | no (research only) |
| 方案 / planner | `plan-author.md` | start of any non-trivial task; or to REVISE after objections/failures | no (read-only) |
| 对抗评审 / architect | `adversarial-architect.md` | after a plan exists, before code — falsify it (8-angle attack) | no (read-only) |
| 执行 / implementer | `surgical-implementer.md` | only after adjudication settles the design | **yes** |
| 真跑验证 / tester | `runtime-verifier.md` | after implementation lands — *runs* it, PASS/FAIL/INCONCLUSIVE | no (scratch only) |
| 验收简报 / review-briefer | `review-briefer.md` | after tester returns PASS (or INCONCLUSIVE you still want briefed), right before the human checkpoint | no (read-only, no Edit/Write) |

**Models:** the **scout** and **architect** run on **opus** — both do hard adversarial / first-principles
reasoning where a strong checker earns its cost. The **implementer** runs on **sonnet** (execution needs
care and bug-spotting, not peak reasoning — cheaper and faster). Planner, tester, and review-briefer
inherit the session model. This is the article's "different model for the checker" — plus a cheaper model
for the mechanical work.

Note **review-briefer is not a checker** — it runs after the verdict is already settled and never issues
one itself (no PASS/FAIL, no "looks good"). Its only job is translating a diff + test evidence that were
written for a fluent code reader into plain language for one who isn't yet — so the human checkpoint is an
informed decision instead of a rubber stamp on a verdict they had to take on faith.

Note the **scout plays by a different grounding standard** than the code-side agents: it can't cite
`file:line`, so it must cite **sources**, separate **verified from assumed**, and state **confidence** —
the guard against a confident-but-hallucinated market claim producing a validated-*sounding* fake requirement.

## Right-size it — the loop is a template you subset from, not an assembly line

None of the six stages is *useless* — each is one of four irreducible operations: **decide** what/whether
(scout, planner) · **build** (implementer) · **check** (architect, tester) · **explain** (review-briefer,
so the acceptance checkpoint is informed). But you almost never run all of them. The gates exist to keep
the common path short — run the **fewest stages the task's blast radius justifies**:

| Task | Stages you actually run |
|---|---|
| Trivial one-liner, no blast radius | just do the edit — **0 agents** |
| Ordinary feature / fix | planner → implementer → tester — **3** |
| Risky / complex / wide blast radius | + adversarial-architect — **4** |
| Novel / greenfield / requirement in doubt | + requirement-scout at the front — **5** |
| Non-trivial task that reached PASS and you can't yet read the diff fluently | + review-briefer right before the checkpoint — **+1** (skip it too on the trivial one-liners above — a brief for a typo fix is noise, not teaching) |
| Outcome still in doubt after it's built | + the acceptance checkpoint (you) at the end |

If the loop ever *feels* long, you're looking at its **maximal** form — subset it. ~90% of work is the
3-stage path. Adding a stage is a deliberate response to risk (or, for review-briefer, to how much of the
diff you can already read yourself), never a ritual.

## How to run it

**Manual mode** (start here — you stay in the loop, low cost): if the requirement itself is uncertain
or greenfield, start one step earlier with `requirement-scout` — a **KILL** verdict means you're done,
you just saved yourself from building the wrong thing. Otherwise start at `plan-author`, hand its plan to
`adversarial-architect`, adjudicate the objections yourself, hand the settled plan to `surgical-implementer`,
then `runtime-verifier`. On PASS, hand the diff and the verifier's report to `review-briefer` for a
plain-language brief — skip this for trivial changes you already understand cold. You are the orchestrator
and the adjudicator — the single human checkpoint the article insists you keep.

**Workflow mode** (once the flow is trustworthy): a deterministic script wires plan→review→
(loop until PROCEED)→implement→verify→(loop until PASS)→brief, so you design it once and press go.

The two verdict lines are **machine-routable on purpose** — `VERDICT: PROCEED|REVISE|REJECT` and
`PASS|FAIL|INCONCLUSIVE` — so a script can branch on them without parsing prose.

## Memory spine (block #6) — the reason tomorrow's run isn't amnesiac

The model forgets everything between runs; the disk doesn't. Drop a `LOOP-STATE.md` at each
project root and have every stage read it first and write it last:

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
```

Claude Code already ships a refined version of this idea (`~/.claude/.../memory/` = one fact per
file + a `MEMORY.md` index with a `description` for recall). Use it for facts that outlive one
project; use `LOOP-STATE.md` for the live per-project loop state.

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
12. **Make the outcome legible to the human who has to judge it** → review-briefer turns a diff + a verdict into a plain-language brief, so the acceptance checkpoint is an informed decision and not a rubber stamp on a PASS the human couldn't read.

## Still to add when you open a real project (blocks #1, #2, #4)

Global-reusable core (#5 agents, #6 memory convention, the tips above) is done. These attach to a repo:

- **#1 Heartbeat** — make it a *loop*, not a run: `/loop` (interval / self-paced in-session) or `/schedule` (cloud cron, survives closing the laptop), or lifecycle `hooks` (e.g. PostToolUse → run tests / auto-commit).
- **#2 Worktrees** — parallel isolation so two agents don't collide: `git worktree`, or `isolation: worktree` on a sub-agent (already declared on the implementer).
- **#4 Connectors** — MCP servers so the loop touches your real tools (issue tracker, DB, Slack, staging API) and can open the PR + update the ticket itself.
- **Per-project weighting** — a thin line in the project's `CLAUDE.md` re-weights the architect's 8 angles (e.g. "payments system: correctness + reversibility over speed") without forking the global agent.

## Stay the engineer

The loop changes the work, it doesn't delete you from it. Verification is still yours; comprehension
debt grows faster the smoother the loop runs; the comfortable posture (take whatever it gives back) is
the risky one. Design the loop to go faster on work you understand — not to avoid understanding it.
