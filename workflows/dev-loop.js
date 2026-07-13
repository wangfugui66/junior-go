export const meta = {
  name: 'junior-go-dev-loop',
  description: 'Right-sized six-agent loop: scout(gated) -> plan -> review -> implement -> verify -> explain',
  whenToUse: 'Non-trivial build/fix/refactor tasks in a project that has the junior-go agents installed (~/.claude/agents/). Pass args: { task: string, risk?: "trivial"|"ordinary"|"risky"|"novel" }. Omit risk to let the workflow classify it from LOOP.md\'s Right-size it table.',
  phases: [
    { title: 'Classify' },
    { title: 'Scout' },
    { title: 'Plan' },
    { title: 'Review' },
    { title: 'Implement' },
    { title: 'Verify' },
    { title: 'Explain' },
  ],
}

// This script does NOT redeclare which model each agent uses — every one of the six
// agents already pins its own model in its own frontmatter (see agents/LOOP.md's
// "Models" section). Calling agent(..., { agentType: 'plan-author' }) resolves the
// real registered agent, tool grant and all, exactly like invoking it via the Agent
// tool by name. Passing a model override here would just be a second, driftable copy
// of a fact that already lives in the agent file.

const MAX_ARCHITECT_ROUNDS = 3
const MAX_TESTER_ROUNDS = 3

function lastVerdict(text, pattern) {
  const lines = String(text).trim().split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(pattern)
    if (m) return m[1]
  }
  return null
}

if (!args || !args.task) {
  throw new Error('junior-go-dev-loop requires args: { task: "<what to build/fix>" }')
}
const task = args.task

// ---- 0. Right-size it: how many of the six stages does this task actually justify? ----
phase('Classify')
let risk = args.risk
if (!risk) {
  log('No risk tier passed in args.risk - asking a cheap classifier to read LOOP.md\'s Right-size it table.')
  const raw = await agent(
    'Read agents/LOOP.md\'s "Right-size it" table (or, if that file is not in this repo, apply its ' +
      'definitions from memory: trivial = one-liner/no blast radius; ordinary = normal feature/fix; ' +
      'risky = complex/wide blast radius; novel = greenfield/requirement genuinely in doubt). ' +
      'Classify the task below into EXACTLY one of these four words and reply with ONLY that word, ' +
      'nothing else, no punctuation.\n\nTask:\n' + task,
    { label: 'risk-classify', effort: 'low' }
  )
  risk = String(raw).trim().toLowerCase()
  log(`Classified as: ${risk}`)
}

if (risk === 'trivial') {
  return {
    skipped: true,
    reason: 'Right-size it: trivial, no-blast-radius change - 0 agents. Make the edit yourself, no loop needed.',
  }
}

// ---- 1. requirement-scout - gated, novel/greenfield only ----
phase('Scout')
let spec = null
if (risk === 'novel') {
  const scoutOut = await agent(
    'You are requirement-scout for this task. Validate WHAT and WHY before any plan exists.\n\nTask:\n' + task,
    { agentType: 'requirement-scout', label: 'scout' }
  )
  const verdict = lastVerdict(scoutOut, /VERDICT:\s*(PROCEED|REFRAME|KILL)/)
  if (verdict === 'KILL') {
    log('Scout: KILL - stopping before any plan or code is produced.')
    return { killed: true, stage: 'scout', report: scoutOut }
  }
  // PROCEED and REFRAME both hand a usable spec forward to the planner.
  spec = scoutOut
}

// ---- 2. plan-author, with the architect's REVISE <-> REBUT loop ----
phase('Plan')
let plan = await agent(
  spec
    ? `Task:\n${task}\n\nrequirement-scout's output (spec or reframed need):\n${spec}`
    : `Task:\n${task}`,
  { agentType: 'plan-author', label: 'plan' }
)

let architectVerdict = null
let lastArchitectOut = null
let architectRound = 0
// Every architect pass, not just the winning one - a REVISE-round pass can still have
// emitted a MEMORY-NOTE APPEND: block (adversarial-architect has no Write; that's its
// only way to persist a durable finding). Keeping only lastArchitectOut would silently
// drop any such block from an earlier round the moment the loop moves on.
const architectReports = []

if (risk === 'risky' || risk === 'novel') {
  phase('Review')
  while (architectRound < MAX_ARCHITECT_ROUNDS) {
    architectRound++
    lastArchitectOut = await agent(
      'Review this plan (Pass A if this is its first review, or the delta if revised):\n\n' + plan,
      { agentType: 'adversarial-architect', label: `architect-pass-${architectRound}` }
    )
    architectReports.push(lastArchitectOut)
    architectVerdict = lastVerdict(lastArchitectOut, /VERDICT:\s*(PROCEED|REVISE|REJECT)/)
    if (architectVerdict === 'PROCEED' || architectVerdict === 'REJECT') break

    // REVISE: hand the objections back to plan-author for a revision, then re-attack.
    plan = await agent(
      'Your plan received architect objections. Concede, rebut, or defer each, then revise.\n\n' +
        `Original plan:\n${plan}\n\nArchitect's findings:\n${lastArchitectOut}`,
      { agentType: 'plan-author', label: `plan-revise-${architectRound}` }
    )
  }

  if (architectVerdict === 'REJECT') {
    log('Architect: REJECT - the approach itself is falsified. Stopping for a human/planner re-design, not another blind attempt.')
    return { rejected: true, stage: 'architect', rounds: architectRound, spec, plan, report: lastArchitectOut, architectReports }
  }
  if (architectVerdict !== 'PROCEED') {
    log(`Architect has not reached PROCEED after ${MAX_ARCHITECT_ROUNDS} rounds - that's the same-objection-recurring escalation trigger both agent files call out. Stopping instead of looping forever.`)
    return { stuck: true, stage: 'architect', rounds: architectRound, spec, plan, lastReport: lastArchitectOut, architectReports }
  }
}

// ---- 3. surgical-implementer, with the tester's FAIL <-> fix loop ----
phase('Implement')
let impl = await agent(
  'Implement this adjudicated plan.\n\n' +
    `Plan:\n${plan}` +
    (lastArchitectOut ? `\n\nArchitect's final review (honor any mandated safeguards):\n${lastArchitectOut}` : ''),
  { agentType: 'surgical-implementer', label: 'implement' }
)

phase('Verify')
let testVerdict = null
let testOut = null
let testerRound = 0
while (testerRound < MAX_TESTER_ROUNDS) {
  testerRound++
  testOut = await agent(
    `Verify this implementation against the plan's success criteria.\n\nPlan:\n${plan}\n\nImplementer hand-off:\n${impl}`,
    { agentType: 'runtime-verifier', label: `verify-${testerRound}` }
  )
  testVerdict = lastVerdict(testOut, /VERDICT:\s*(PASS|FAIL|INCONCLUSIVE)/)
  if (testVerdict === 'PASS' || testVerdict === 'INCONCLUSIVE') break

  // FAIL: hand the minimal repro back to the implementer.
  impl = await agent(
    'The tester found a failure. Reproduce it, then fix the SPECIFIC failure with the smallest delta ' +
      '- or rebut with evidence if it does not reproduce against a correct exercise of your change.\n\n' +
      `Original hand-off:\n${impl}\n\nTester's failure report:\n${testOut}`,
    { agentType: 'surgical-implementer', label: `implement-fix-${testerRound}` }
  )
}

if (testVerdict === 'INCONCLUSIVE') {
  log('Tester: INCONCLUSIVE - could not execute the decisive check. Not a pass; needs a human to unblock the environment.')
  return { inconclusive: true, stage: 'tester', rounds: testerRound, spec, plan, architectReports, impl, report: testOut }
}
if (testVerdict !== 'PASS') {
  log(`Tester has not reached PASS after ${MAX_TESTER_ROUNDS} rounds - the same failure recurring is plan-author's own escalation trigger, not implementer's to keep patching. Stopping.`)
  return { stuck: true, stage: 'tester', rounds: testerRound, spec, plan, architectReports, impl, lastReport: testOut }
}

// ---- 4. junior-explainer - only reached on a real PASS ----
phase('Explain')
const brief = await agent(
  'Write the junior-facing explanation and the Junior Memory Update Proposal for this round.\n\n' +
    `Task:\n${task}\n\nPlan:\n${plan}\n\nImplementer hand-off:\n${impl}\n\nTester report:\n${testOut}`,
  { agentType: 'junior-explainer', label: 'explain' }
)

// This return value is ALL that reaches the main conversation - every intermediate
// plan draft and implementer retry stayed in its own subagent transcript. spec and
// architectReports are included in full (not just the winning pass) specifically so
// any MEMORY-NOTE APPEND: block a no-Write agent (scout, architect) emitted along the
// way surfaces here instead of being silently lost with its subagent's transcript -
// see memory/README.md's "Writing, promotion, and cleanup" for what happens to these
// at the human acceptance checkpoint. The human acceptance checkpoint (accept /
// reject-and-route) still happens after this, on this returned material - the
// workflow does not self-certify.
return {
  passed: true,
  risk,
  architectRounds: architectRound,
  testerRounds: testerRound,
  spec,
  plan,
  architectReports,
  impl,
  testReport: testOut,
  brief,
}
