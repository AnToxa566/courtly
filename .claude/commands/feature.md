---
name: feature
description: Runs the full cycle for a roadmap item or a described task — product owner brief → planner → human approval → executor → reviewer → architect (risky items only) → product owner close
argument-hint: '[optional: a roadmap ID or a task in your own words]'
disable-model-invocation: true
---

Run the full development cycle. Request: $ARGUMENTS

You are the orchestrating session. Subagents cannot talk to each other or to
me, so you carry every message between them. Give each one the current date
when it needs to record something. Product questions go to the
`product-owner` before they come to me.

## 1. Choose the work

- **If the request is empty:** use the `product-owner` in PICK mode.
  - On `NOTHING_READY`, show me the reason and stop.
  - On `NEXT`, ask me with AskUserQuestion: "Write the brief for <ID> <title>?", with the picked item first (marked recommended), then the "Also ready" items, then "Stop".
- **If the request names a roadmap ID or describes a task:** skip the question; that is my choice.

## 2. Brief

Use the `product-owner` in BRIEF mode for the chosen item.

- On `BLOCKED`, show me why and stop.
- If the brief lists open questions under "Open", ask me with AskUserQuestion, one question per open item, the product owner's proposal first and marked recommended. Pass each answer to the `product-owner` in RECORD mode, then ask it for the brief again.
- The final brief goes straight to the planner.

## 3. Plan

Use the `planner` subagent with the brief. Tell it to read docs/DECISIONS.md along with AGENTS.md, docs/ARCHITECTURE.md and, where the task calls for it, docs/SECURITY.md.

If the plan has open questions:

1. Send them to the `product-owner` in ANSWER mode.
2. `ANSWERED`: give the answers to the planner and have it finalise the plan.
3. `NEEDS_HUMAN`: ask me with AskUserQuestion, the proposal first and marked recommended, the other options after it. Pass my answer to the `product-owner` in RECORD mode, then to the planner.
4. `NOT_MINE`: the planner decides; if it cannot, ask me.

Then show me the plan, with a short list of the questions answered on the way and their sources. **Stop and wait for my approval before any file is touched.**

## 4. Execute

Once I approve, use the `executor` subagent: one step at a time, verification after each, never skipping ahead.

If the executor stops with a question:

1. Send it to the `product-owner` in ANSWER mode first.
2. `ANSWERED`: continue the executor with the answer.
3. `NEEDS_HUMAN`: ask me as in step 3, record my answer through the `product-owner`, and continue the executor with it.
4. `NOT_MINE`: ask me.

To continue the executor, resume the same agent if you can. Otherwise start it again with the plan, the steps already completed and the answer.

## 5. Review loop

Use the `reviewer` subagent on the diff, in a fresh context. Give it the brief, the approved plan and the executor's list of files and commands — not the conversation.

- On `CHANGES_REQUESTED`, have the executor fix the blocking items and run the reviewer again.
- Repeat until `APPROVED`, at most 3 rounds. If it is still not approved after 3, stop and show me the plan, the diff and the last review so I can decide instead of looping.

Review findings are not product questions: they never go to the product owner.

## 6. Architect sign-off

Run it only for Q1, for B5 and B6, and for any plan the planner flagged for the
`Booking` table, guards or roles. For every other item, skip to step 7 and
tell me the architect was skipped.

Once the reviewer approves, use the `architect` subagent for structural fit.

- On `CHANGES_REQUESTED`, fix and go back through step 5 before returning here.
- At most 2 rounds, same stop rule.

## 7. Close

Give the `product-owner` the `VERDICT: APPROVED` lines that were required and the executor's summary, in CLOSE mode, and say whether the architect ran.

Then summarise for me:

- what changed, which files, which commands ran and their results
- the verdicts, and whether the architect ran
- every question answered on the way, with who answered it: the documents or me
- the product owner's "Now ready" and "Facts for the README"
- whether the threat table in docs/SECURITY.md or "Known open problems" in docs/ARCHITECTURE.md needs updating, with the exact edit
- a commit message that follows the conventions in AGENTS.md

**Do not commit. Wait for me.**
