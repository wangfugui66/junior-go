---
name: dev-loop-orchestrator
description: This skill should be used when the user asks to build, fix, refactor, debug, or spike any non-trivial change — beyond a one-line edit with no blast radius. Also use it when the user mentions "the loop", "loop engineering", "right-size it", "LOOP-STATE.md", or any of the six sub-agents by name ("requirement-scout", "plan-author", "adversarial-architect", "surgical-implementer", "runtime-verifier", "review-briefer"), or asks how to orchestrate them. Teaches the acting model when and how to invoke each sub-agent via the Agent tool, how to route their PROCEED/REVISE/REJECT, PROCEED/REFRAME/KILL, and PASS/FAIL/INCONCLUSIVE feedback edges, how to scale down to zero agents for trivial work, and how to maintain the LOOP-STATE.md memory spine. Skip this skill for trivial one-liners with no blast radius.
version: 0.1.0
---

# The Loop — orchestrating the six closed-loop dev sub-agents

Six sub-agents live in `agents/*.md` (`requirement-scout`, `plan-author`, `adversarial-architect`,
`surgical-implementer`, `runtime-verifier`, `review-briefer`). Each agent file is self-contained and
defines its own behavior — do not restate or duplicate their instructions here. This skill teaches the
**orchestration layer**: which agent to invoke, in what order, how to route each stage's feedback back
into the loop, how much of the loop a given task actually warrants, and how to keep state alive across
runs. Invoke every stage below through the Agent tool, passing the agent's file name as `subagent_type`.

Loop engineering means designing the system that prompts the model, instead of prompting it turn by
turn. These six agents are the reusable core of that system; the memory spine at the end is what keeps
it a *loop* instead of a one-shot.

## Before invoking anything: right-size the task

Never run the full six-stage loop by default — that defeats the point. Each stage is one of three
irreducible operations: **decide** what/whether (scout, planner), **build** (implementer), **check**
(architect, tester, plus a human acceptance checkpoint). Pick the fewest stages the task's blast radius
justifies:

| Task | Stages to run |
|---|---|
| Trivial one-liner, no blast radius | Just make the edit — **0 agents**. Do not invoke this skill's stages at all. |
| Ordinary feature / fix | `plan-author` → `surgical-implementer` → `runtime-verifier` — **3** |
| Risky / complex / wide blast radius | + `adversarial-architect` before implementation — **4** |
| Novel / greenfield / requirement in doubt | + `requirement-scout` at the very front — **5** |
| Outcome still in doubt after it's built | + the human acceptance checkpoint at the end |
| The diff isn't yet readable by the human operator | + `review-briefer`, right before that checkpoint |

About 90% of non-trivial work is the 3-stage path (plan → implement → verify). Only add a stage as a
deliberate response to risk — never as ritual. If the loop ever feels long, that's its **maximal** form —
subset it. The one exception worth defaulting **on** regardless of risk is `review-briefer`: it is cheap,
never blocks the loop, and skipping it while the operator is still building fluency just re-creates the
comprehension debt the loop exists to remove (see "Protect the operator's understanding" below).

## The loop, end to end

```
requirement-scout ─spec─▶ plan-author ─plan─▶ adversarial-architect ─VERDICT─▶ surgical-implementer ─▶ runtime-verifier
        │ (gated: novel/greenfield)   ▲                    ▲   │                        │                      │
        │ KILL → stop (no plan, no code)  │ REVISE          │   │ rebuttal (operator decides)  │ diff + commits       │
        ▼                             └────────────────────┘   └── root cause: wrong requirement ◀┴── FAIL / irreversible / PASS
     (stop)                                                    (feeds back to scout, not planner)          │
                                                                                                       PASS  ▼
                                                                                             review-briefer (optional,
                                                                                             also usable on INCONCLUSIVE)
                                                                                       (plain-language brief, no verdict)
                                                                                                             │
                                                                                                             ▼
                                                                                     human operator: 5-second acceptance checkpoint
```

The feedback edges are what make this a *loop* rather than a pipeline — route by them explicitly:

- `requirement-scout` is **gated**: only invoke it when the requirement is novel, greenfield, or
  genuinely uncertain. Its verdict vocabulary is `PROCEED` / `REFRAME` / `KILL`. A `KILL` stops everything
  before any plan or code is produced — the cheapest bug to fix is the feature that never gets built.
- `adversarial-architect` ↔ `plan-author`: the architect's verdict vocabulary is `PROCEED` / `REVISE` /
  `REJECT`. A `REVISE` bounces the plan back to `plan-author` for a new revision; re-run the architect on
  the revision. The human operator adjudicates any rebuttal — do not let the architect and planner loop
  indefinitely without surfacing the disagreement.
- `runtime-verifier`'s verdict vocabulary is `PASS` / `FAIL` / `INCONCLUSIVE` — a separate vocabulary from
  the other two stages, not interchangeable with theirs. `FAIL` routes to different stages depending on
  root cause: a code bug goes back to `surgical-implementer`; a design flaw goes back to `plan-author`;
  and if the root cause is that the *requirement itself* was wrong, route all the way back to
  `requirement-scout` — never silently absorb a wrong-requirement failure into a smaller fix.
- An irreversible action discovered mid-implementation or mid-verification routes to a ROLLBACK
  recommendation, not to a silent retry.
- `runtime-verifier`'s `PASS` is **not** the finish line — it means "built to spec," not "achieves the
  effect the operator actually wanted." Do not report a task as done on PASS alone. The real close is a
  human acceptance checkpoint: PASS → operator eyeballs the result → **accept** (write memory, done) or
  **reject**, routed by *why*: wrong effect because the need/criteria were wrong → back to
  `requirement-scout` (REFRAME); right need but a bad approach → back to `plan-author`. This is
  deliberately a human judgment call, not a seventh agent stage with its own verdict.
- `runtime-verifier` → `review-briefer` is optional, offered on `PASS` (or on `INCONCLUSIVE` if the
  operator wants a brief on partial progress anyway): if the diff isn't yet self-explanatory to the human
  operator, invoke `review-briefer` to translate it into a plain-language brief *before* the acceptance
  checkpoint. It hands the operator material to reason from — it does not rule on accept/reject; that call
  stays 100% human. Note `review-briefer`'s own output template is hard-coded in Chinese regardless of the
  session's working language — expect a Chinese brief even from an all-English session.

## The six roles

| Role | `subagent_type` | Fires when | Can mutate source? | Model |
|---|---|---|---|---|
| Requirement validation | `requirement-scout` | Gated — only when the requirement is novel/greenfield/uncertain; validates WHAT & WHY before any planning | No (research only) | opus |
| Plan authoring | `plan-author` | Start of any non-trivial task, or to produce a REVISE after objections/failures | No (read-only) | inherit |
| Adversarial review | `adversarial-architect` | After a plan exists, before any code — falsifies it via an 8-angle attack | No (read-only) | opus |
| Implementation | `surgical-implementer` | Only after the design is adjudicated/settled | **Yes** | sonnet |
| Runtime verification | `runtime-verifier` | After implementation lands — actually runs it, emits PASS/FAIL/INCONCLUSIVE | No (scratch only) | inherit |
| Review briefing | `review-briefer` | Optional, after `runtime-verifier` PASS (or INCONCLUSIVE, if asked), right before the human's acceptance checkpoint — translates the settled diff + test evidence into a plain-language brief | No (read-only, no verdict) | inherit |

`requirement-scout` and `adversarial-architect` run on **opus** because both do hard adversarial /
first-principles reasoning where a strong checker earns its cost. `surgical-implementer` runs on
**sonnet** — execution needs care and bug-spotting, not peak reasoning, and is cheaper/faster.
`plan-author`, `runtime-verifier`, and `review-briefer` inherit the session model — summarization,
verification-by-running, and translation don't need the adversarial tier either. This is "use a
different, stronger model for the checker" plus "use a cheaper model for mechanical work."

`requirement-scout` and `adversarial-architect` work in whatever language the request and repo are
written in (Chinese or English) — match the asker rather than translating. `requirement-scout` also plays
by a different grounding standard than the code-side agents: it cannot cite `file:line`, so its output
must cite sources, separate verified from assumed claims, and state confidence — the guard against a
confident-but-hallucinated market claim producing a validated-*sounding* fake requirement. The code-side
agents (`adversarial-architect`, `runtime-verifier`) must ground every claim in `file:line` plus a
concrete failure scenario, and must never grade their own homework — `adversarial-architect` and
`runtime-verifier` are both strictly non-mutating.

## How to run it

**Manual mode** (default — keeps the human operator in the loop, low cost): if the requirement is
uncertain or greenfield, start one step earlier at `requirement-scout` — a `KILL` verdict means stop,
nothing further is needed. Otherwise start at `plan-author`, hand its plan to `adversarial-architect`,
have the operator adjudicate any objections, hand the settled plan to `surgical-implementer`, then to
`runtime-verifier`. On PASS, invoke `review-briefer` before the operator's own accept/reject pass — one
cheap agent call that turns the diff into something the operator can actually read and learn from. The
human operator is the orchestrator and adjudicator throughout — never collapse that checkpoint into an
agent's verdict.

**Workflow mode** (once the flow is trustworthy for a given project): a deterministic script/hook can
wire plan → review → (loop until PROCEED) → implement → verify → (loop until PASS) → brief so the human
presses go once. The verdict lines are machine-routable by design — parse the exact tokens
(`PROCEED|REVISE|REJECT`, `PROCEED|REFRAME|KILL`, `PASS|FAIL|INCONCLUSIVE`) directly rather than the
surrounding prose when building or driving such automation.

## Memory spine — do not run this loop amnesiac

The model forgets everything between runs; disk does not. At the root of whatever project this loop is
running against, maintain a `LOOP-STATE.md` — read it before starting any stage, and write it after
finishing one:

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
- <what was tried, what the architect killed and why — so it isn't relitigated>
```

Use the durable, cross-project `~/.claude/.../memory/` convention (one fact per file plus a `MEMORY.md`
index with a `description` for recall) for facts that outlive a single project. Use `LOOP-STATE.md` for
the live, per-project loop state — which stage is holding the ball right now, and why.

## Claude Code harness patterns folded into this loop

These are general Claude Code harness patterns; know where each one already lives inside the six agents
so as not to reinvent it:

1. **State on disk, indexed for recall** (memory: one-fact files + `MEMORY.md`) → the `LOOP-STATE.md` spine above.
2. **Ground every claim in `file:line` + a concrete failure scenario; no generic boilerplate** (`/code-review`, ReportFindings) → the architect's evidence standard and the tester's grounding rule.
3. **Verify by driving the real flow, not tests-only** (`/verify`: ship code confirmed to work) → the tester's prime directive: no PASS without a command that produced it.
4. **Maker ≠ checker** (subagents + adversarial review) → `adversarial-architect` and `runtime-verifier` are strictly non-mutating; they cannot grade their own homework.
5. **Smallest diff, match surrounding idiom, prefer edit over create** (general coding discipline) → `surgical-implementer`.
6. **Front-load decisions once via plan mode; don't ask mid-run** → `plan-author` decides up front, which is also how mid-run human-in-the-loop friction gets eliminated.
7. **Externalize multi-step progress (TodoWrite)** → every agent keeps a ledger so re-runs are targeted, not from-scratch.
8. **Confirm before hard-to-reverse / outward-facing actions; approval doesn't carry across contexts** → `surgical-implementer` stops on irreversible steps; `runtime-verifier` escalates and recommends rollback.
9. **Report outcomes faithfully — say when tests fail, never claim done unverified** → the tester's three-valued verdict; `INCONCLUSIVE` is not a courtesy PASS.
10. **Structured, schema-forced hand-offs** → the machine-routable verdict lines.
11. **Isolation for parallel work · permission modes + allowlists to cut prompts · hooks for deterministic lifecycle** → the surrounding plumbing; `surgical-implementer` already uses the `EnterWorktree`/`ExitWorktree` tools for this.

## Per-project attachments this skill does not provide

The six agents plus the memory-spine convention are the global, reusable core. The following attach at
the level of an individual project and are not part of this skill — set them up per repo when needed:

- **Heartbeat** — turning a single loop pass into a recurring one: `/loop` (interval or self-paced,
  in-session) or `/schedule` (cloud cron, survives closing the session), or lifecycle hooks (e.g.
  PostToolUse → run tests / auto-commit).
- **Worktrees** — parallel isolation so two agents don't collide: `git worktree`, or the `EnterWorktree`/
  `ExitWorktree` tools already used by `surgical-implementer`.
- **Connectors** — MCP servers so the loop can reach real external tools (issue tracker, DB, Slack,
  staging API) and open the PR / update the ticket itself.
- **Per-project weighting** — a short line in the project's own `CLAUDE.md` can re-weight the
  architect's 8 attack angles (e.g. "payments system: correctness + reversibility over speed") without
  forking the global agent definition.

## Protect the operator's understanding

The loop changes how the work gets done, it does not remove the human operator from it. Verification
stays theirs; comprehension debt grows faster the smoother the loop runs, and simply accepting whatever
the loop hands back is the risky posture. Design the loop to go faster on work the operator understands —
not to avoid understanding it. When running this loop for someone who is still building fluency reading
diffs cold, default `review-briefer` **on** rather than gating it by risk — it doesn't lower the bar for
what the operator needs to understand, it lowers the cost of understanding it. Never compress the human
acceptance checkpoint into an agent's verdict, no matter how confident that verdict sounds —
`runtime-verifier` PASS certifies "built to spec," not "operator understood and wanted this."
