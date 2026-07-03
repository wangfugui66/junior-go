# The Loop — a reusable closed-loop dev harness

Four global sub-agents (`~/.claude/agents/*.md`) that split **generation** from **verification**
and feed each other. This file is the operator's guide: how they wire together, the memory spine
that makes it a *loop* and not a one-shot, and the Claude Code harness tips baked in.

> Loop engineering = you stop prompting the agent turn-by-turn and instead design the system that
> prompts it. These four are block #5 (sub-agents) of that system. The memory spine below is block #6.

## The loop

```
   ┌─────────────────────────────────────────────────────────────┐
   │                                                             ▼
方案 plan-author ──plan──▶ 对抗评审 adversarial-architect ──VERDICT──▶ 执行 surgical-implementer
   ▲                          │        ▲                                        │
   │ REVISE (design wrong)    │ REVISE │ rebuttal (you adjudicate)              │ diff + commits
   │                          ▼        │                                        ▼
   └──────────────── 真跑验证 runtime-verifier ◀───────── PASS/FAIL/INCONCLUSIVE ┘
        FAIL→implementer (code bug) │ FAIL→planner (design wrong) │ irreversible→ROLLBACK │ PASS→write memory
```

The **feedback edges** (architect↔planner, tester→implementer/planner, irreversible→rollback,
PASS→memory) are what close the loop. Without them it's just a pipeline.

## The four roles

| Role | File | Fires when | Can mutate source? |
|---|---|---|---|
| 方案 / planner | `plan-author.md` | start of any non-trivial task; or to REVISE after objections/failures | no (read-only) |
| 对抗评审 / architect | `adversarial-architect.md` | after a plan exists, before code — falsify it (8-angle attack) | no (read-only) |
| 执行 / implementer | `surgical-implementer.md` | only after adjudication settles the design | **yes** |
| 真跑验证 / tester | `runtime-verifier.md` | after implementation lands — *runs* it, PASS/FAIL/INCONCLUSIVE | no (scratch only) |

The architect runs on **opus** (a strong checker catches what a tired maker talked itself into);
the rest inherit the session model. This is the article's "different model for the checker".

## How to run it

**Manual mode** (start here — you stay in the loop, low cost): in a session, ask for the
`plan-author`, then hand its plan to `adversarial-architect`, adjudicate the objections yourself,
hand the settled plan to `surgical-implementer`, then `runtime-verifier`. You are the orchestrator
and the adjudicator — the single human checkpoint the article insists you keep.

**Workflow mode** (once the flow is trustworthy): a deterministic script wires plan→review→
(loop until PROCEED)→implement→verify→(loop until PASS), so you design it once and press go.

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
