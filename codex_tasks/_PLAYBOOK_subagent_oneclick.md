# Sub-agent One-click Playbook (Codex Orchestration Standard)

Status: ACTIVE
Owner: Codex
Scope: Supplemental guidance only (`AGENTS.md` remains authoritative)
Last Updated: 2026-02-12

---

## 1) Purpose

Define a repeatable one-click execution mode where the user delegates a scoped task chain and Codex orchestrates sub-agents end-to-end.

This playbook does not replace task specs and does not replace `AGENTS.md`.

---

## 2) Input Contract (User -> Codex)

Required input:
- business goal
- priority
- constraints (scope/risk/deadline)
- delegation signal for a bounded chain

Optional input:
- preferred ordering between task IDs
- release target (local only, push, deploy check)

Example delegation signal:
- "승인. task_004~009 위임 실행."

---

## 3) Role Set (6 baseline)

- Spec-Writer
- Spec-Reviewer
- Implementer-A
- Implementer-B
- Implementer-C
- Reviewer+Verifier

Codex remains final decision owner for:
- spec lock
- merge decision
- completion status

---

## 4) Pipeline (normative)

1. Spec-Writer drafts spec(s) from input contract.
2. Spec-Reviewer checks scope, acceptance, rollback, ambiguity.
3. Codex locks spec(s) and starts execution if escalation is not required.
4. Implementer-A/B/C run parallel branches with file ownership lock.
5. Reviewer+Verifier runs one review/verification pass.
6. Codex resolves findings, classifies failures, and publishes final report.

Progress policy:
- blocker-only updates during delegated execution
- one final report after closeout

---

## 5) Parallelism Rules (DAG + waves)

- Build dependency DAG from approved specs.
- Run independent nodes in parallel waves.
- Respect runtime sub-agent limit (baseline 6).
- If file ownership conflict appears, switch conflicted scope to sequential mode.
- Reuse role types across waves; do not keep idle agents pinned.

---

## 6) Escalation Conditions (Codex -> User)

Codex must pause for confirmation when:
- breaking change
- new dependency
- security or cost policy impact
- data migration requirement
- layout task requiring Gemini SVG draft

If no escalation trigger is hit, Codex continues inside delegated window.

---

## 7) Repo-local Execution Boundaries

- Default implementation target: `canvas-editor-app/`
- Legacy root edits (`index.html`, `js/`, `css/`) require explicit scope + patch-note awareness
- Vendor source is always read-only
- Local gate commands:
  - `bash scripts/scan_guardrails.sh`
  - `bash scripts/check_guardrails.sh`
  - `bash scripts/guardrails.sh`
  - `cd canvas-editor-app && npm run lint`
  - `cd canvas-editor-app && npm run build`

---

## 8) Gemini Bridge Rule (layout tasks only)

Gemini is SVG-only.

Flow:
1. Codex prepares SVG request packet.
2. User relays packet to Gemini.
3. Gemini returns one SVG draft.
4. Codex implements from the draft with numeric redlines.

No iterative unlimited Gemini loop by default.

---

## 9) Fallback Mode

If sub-agent runtime is disabled/unavailable:
- switch to single-Codex mode immediately
- keep same spec gates/scope/escalation policy
- continue without redesigning task plan

---

## 10) Output Contract (Codex -> User)

Final report must include:
- completed task IDs and status
- changed files summary
- gate results (lint/build/scripts)
- failure classification (`pre-existing` vs `new`, `blocking` vs `non-blocking`)
- risks and follow-up actions (if any)
