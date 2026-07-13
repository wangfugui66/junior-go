# memory/ — the durable knowledge spine (protocol & schema, single source of truth)

`LOOP-STATE.md` (see `agents/LOOP.md` § "Memory spine") is the loop's *live, single-task* working
memory — a disposable inbox for the run in progress. `memory/junior/` (see `agents/LOOP.md` §
"Junior memory spine") is a separate, one-directional record of what the human operator has been
shown. **This directory is the third spine: a distilled, cross-task, cross-session library of
project knowledge** — the stuff worth remembering *after* the task that produced it is long done.
This file is the schema/protocol that all six agents and the human orchestrator follow when they
touch it. If any agent file and this file ever disagree on format, this file wins.

## Scope — what belongs here, what doesn't

Store only information that is **stable and reusable**: project conventions, idioms this repo
actually uses, pitfalls that cost real time to discover, the user's taste/standards as observed
across rounds, decisions that keep coming back up. This is a curated library, not a log.

**Never store:** secrets/credentials/tokens, one-off instructions for a single task, raw private
data, or an undigested dump of a whole conversation. If you're not sure a fact will still matter
three tasks from now, it probably belongs in `LOOP-STATE.md` instead, not here.

## Where this lives at runtime (important — read this before anything else)

This memory subsystem's **live data lives at the target project's root** (nearest ancestor with
`.git`, or the working directory if there's none) — exactly the same placement convention as
`LOOP-STATE.md` and `memory/junior/`, both of which already work this way; see `agents/LOOP.md` for
those two existing precedents.

**The three files under this harness repo's own `memory/` — this `README.md`, `MEMORY.md`, and the
sample note under `notes/` — are schema examples / fixtures, not live data.** They exist so anyone
reading this repo can see the exact shape of a real `memory/MEMORY.md` and a real
`memory/notes/*.md` file without having to run the loop first. **They are not read by any agent at
runtime** when the loop operates against an actual target project — the agents read *that project's*
`memory/MEMORY.md` and `memory/notes/*.md`, which are separate files that get created fresh (or
copied from this schema) at that project's own root, the same way a fresh `LOOP-STATE.md` gets
created from `agents/LOOP.md`'s template rather than this repo's own copy being read.

## Layout

```
memory/
  README.md      — this file: protocol + schema, the single source of truth
  MEMORY.md       — the curated layer: short, high-signal, read in full every retrieval
  notes/
    YYYY-MM-DD-<slug>.md   — the raw layer: one dated note per durable finding
  junior/         — a completely separate, pre-existing spine owned solely by junior-explainer.
                    This subsystem does not read it, does not write it, and does not track it in
                    git (see the .gitignore note below) — it is a different spine with a different
                    owner, not a folder this system shares.
```

## `MEMORY.md` format

No YAML frontmatter — it's meant to be skimmed whole, every retrieval, in one `Read`. Structure:

1. A short header paragraph: what belongs in this file and how to use it (what you're reading now,
   one level down — restate it briefly so the file is self-explanatory even in isolation).
2. The body, organized into sections by topic (`## <topic>`). Each entry is **one line**: a plain
   description of the durable fact. Optionally note the source note's date in parentheses if the
   fact was distilled from a specific `notes/` entry, e.g. `- Foo does X (from 2026-07-13 note).`

Keep it small. The moment `MEMORY.md` stops being comfortably readable in one pass, that's a signal
for the human housekeeping pass (see "Cleanup" below) to compress or prune it, not a signal to keep
appending.

## Note files — `memory/notes/*.md`

- **Filename:** `notes/YYYY-MM-DD-<slug>.md` — dated, so the promotion/cleanup pass can reason about
  age at a glance.
- **Required frontmatter:**
  ```yaml
  ---
  date: YYYY-MM-DD
  tags: [tag1, tag2]
  promote: no | proposed | done
  source: <optional — a path, URL, or one-line description of where this came from>
  ---
  ```
  - `date` — matches the filename.
  - `tags` — free-form topic tags, for a human skimming `notes/` directly.
  - `promote` — `no` (not proposed for `MEMORY.md` yet), `proposed` (the writer thinks it's
    durable enough, awaiting the human promotion pass), or `done` (already distilled into
    `MEMORY.md`; the note stays as the original-detail backing record).
  - `source` — optional, freeform.
  - **No `aliases` field.** An earlier draft of this design considered an optional `aliases`
    frontmatter field for pre-storing synonyms/alternate names. That has been rejected: semantic
    and alias matching happens entirely in the retrieving LLM's own knowledge at the moment of
    retrieval (see "Retrieval protocol" below) — disk never stores a synonym table, so there is
    nothing to keep in sync and nothing that can go stale. Do not add an `aliases` field to any
    note, ever.
- **Body:** freeform markdown, written plainly enough that a full `Read` of the note is enough
  grounding on its own — no need to cross-reference other notes to understand one.

## Retrieval protocol — six steps, tool-agnostic

This protocol is written so it works identically whether the invoking agent has `Bash` or not (some
of the six agents — `plan-author` in particular — do not) and whether it has `Write` or not. Every
step below uses only `Read`/`Grep`, which all six agents have.

1. **Read `memory/MEMORY.md` in full.** It's small and high-signal by design (see above) — a
   complete read costs little and gives you the curated layer immediately.
2. **Expand the task's key nouns/identifiers into synonyms yourself.** Take the concrete terms from
   the current task and, using your own knowledge as the LLM performing this retrieval right now,
   mentally expand each into its synonyms, aliases, and canonical names. This expansion happens
   entirely in your own reasoning — there is no on-disk synonym table to consult.
3. **Grep `memory/notes/` for each expanded term.** Use the `Grep` tool (not a raw shell `rg`/`grep`
   invocation — this protocol must work identically for every one of the six agents, including the
   ones with no `Bash` tool at all) to scan `memory/notes/` for each term from step 2.
4. **Read every candidate note in full and judge relevance yourself.** A string match is a
   candidate, not a verdict. Read each hit completely and decide, using your own judgment, whether
   it's actually semantically relevant to the task — discard hits that only matched on an
   unrelated shared word.
5. **Cite the notes that survive step 4 as grounding**, referenced by their `notes/<path>`, in
   whatever output you produce this run (a plan, a review finding, an implementation note, a
   verification report).
6. **If you learn something durable and new this run, write it** using the write rule for your role
   (see "Writing, promotion, and cleanup" below).

**One explicit declaration, stated plainly because it's the core design bet of this whole
subsystem:** semantic/alias matching happens **only** in the reasoning of whichever LLM is doing the
retrieval, at the moment it retrieves. There is no vector index, no embedding store, and no
synonym/alias table anywhere on disk. If that bet ever needs re-litigating, it is a
conscious, adjudicated technical choice already made for this project — not something to
second-guess mid-task.

> **A note for anyone who later tries to *validate* this retrieval capability (e.g. "does the
> agent correctly connect query X to note Y via an alias it was never told on disk?"):** that
> validation is only meaningful if the judging call is made by a **fresh invocation that has not
> seen this design document, this plan, or the conversation that produced them** — give it nothing
> but a plain, conversational query and the `memory/` directory path, never the answer or any
> hint of what alias mapping is being tested. If the party judging the semantic match has already
> read the note (or a transcript containing the note's contents, or this very paragraph) before
> being asked to "retrieve" it, the test is self-proving and demonstrates nothing. This is a
> documentation note for whoever designs that validation later (e.g. a `runtime-verifier` pass
> built specifically to test retrieval) — it is not something this subsystem automates itself.

## Writing, promotion, and cleanup

**Who writes, and how — this reuses each agent's existing `tools:` frontmatter; no agent gets a new
tool grant for this subsystem.**

- **`surgical-implementer` and `runtime-verifier` have `Write`.** They write directly to
  `memory/notes/YYYY-MM-DD-<slug>.md`, following the schema above, `promote: no` by default.
  - `runtime-verifier`'s writes here are scoped narrowly: it only writes notes that are a durable,
    reusable **pitfall or false-green trap discovered during this round's verification** — the same
    category of fact it already logs to `LOOP-STATE.md § Pitfalls / gotchas`, just promoted to the
    cross-session library when it's project-durable rather than single-run. This is not a new
    authority; it's the same persistence responsibility it already has, extended to a second spine.
- **`plan-author`, `adversarial-architect`, and `requirement-scout` have no `Write`**, deliberately
  (the same maker/checker boundary that already keeps them off `LOOP-STATE.md`). Instead, when one
  of them learns something durable, it emits a block in its output — never written to disk by the
  agent itself:
  ```
  MEMORY-NOTE APPEND:
  ---
  date: YYYY-MM-DD
  tags: [tag1, tag2]
  promote: no
  source: <optional>
  ---
  # <slug/title>
  <the durable fact, grounded — same standard as a real note body>
  ```
  This block is deliberately shaped exactly like a real note file (frontmatter + body) so the human
  orchestrator can save it verbatim as `memory/notes/YYYY-MM-DD-<slug>.md` with no reformatting.

- **Promotion (`notes/` → `MEMORY.md`) is human-only.** Owner: the human orchestrator. Trigger:
  every **PASS acceptance checkpoint** — the same "PASS → you eyeball it → accept (write memory,
  done)" checkpoint `agents/LOOP.md` § "The loop" already documents (see that file for the exact
  line). At that checkpoint, the human reviews this round's `MEMORY-NOTE APPEND:` blocks (if any)
  and any note left at `promote: proposed`, and decides per item: promote (copy one distilled line
  into the right `MEMORY.md` section, then flip the source note's frontmatter to `promote: done`),
  leave as raw note, or discard. No agent promotes itself.

- **Cleanup is also human-only.** Owner: the human orchestrator. Trigger: the same acceptance
  checkpoint, plus a periodic review once `notes/` grows past ~50 files. Deleting memory is
  irreversible, so this stays manual by design for now — automating it is a future iteration, not
  part of this subsystem's MVP.

- **Known cost, stated plainly, not glossed over:** `MEMORY-NOTE APPEND:` blocks and the promotion
  step are both manual/orchestrator-only. In **Manual mode**, a human sees every agent's output
  directly and can act on the block each time. In **Workflow mode** (`workflows/dev-loop.js`), only
  the script's final `return` value reaches the calling conversation — every intermediate
  `plan-author`/`adversarial-architect`/`requirement-scout` turn (and any `MEMORY-NOTE APPEND:`
  block it emitted) stays inside that subagent's own transcript and is **not** automatically
  written to disk. If the human doesn't go back and manually apply it, it is silently lost. The
  accepted consequence of this: `MEMORY.md` can sit at its seed content indefinitely under
  Workflow-mode-heavy usage, and retrieval degrades to a plain `notes/` grep with no curated layer
  to lean on. This is a known, accepted MVP tradeoff, not an oversight — see `agents/LOOP.md`'s
  general stance that promotion to durable memory is deliberately human-gated everywhere in this
  harness.

## Boundary with the other memory spines

- **`LOOP-STATE.md`** — real-time, single-task, disposable working memory. Read first every run;
  thrown away in spirit once the task is done (kept on disk only as a rolling log).
- **`memory/` (this subsystem)** — the distilled, durable, cross-task/cross-session library.
  Curated, not a transcript.
- **`memory/junior/`** — a separate, pre-existing, one-directional spine owned entirely by
  `junior-explainer`, tracking what the *human operator* has been shown and their growth. This
  subsystem does not read, write, or reference it, and it is not tracked by this subsystem's
  `.gitignore` carve-out (see the repo's `.gitignore` — `memory/junior/` stays ignored).
- **Cross-project facts** — anything that outlives a single *project*, not just a single task,
  still goes through Claude Code's own native `~/.claude/projects/<project>/memory/` human-promotion
  mechanism (see `agents/LOOP.md`'s "Claude Code harness tips" section). This subsystem does not
  reimplement or replace that layer — it only covers the *project-local*, cross-task/cross-session
  tier that sits between `LOOP-STATE.md` (single task) and Claude Code's global memory
  (cross-project).
