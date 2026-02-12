# Task 006: Sub-agent One-click Playbook Port

Status: COMPLETED
Owner: Codex
Target: docs-only
Date: 2026-02-12

## Goal
- What to change:
  - Port SY-Math-Slate one-click delegated execution playbook into this repository as a reusable governance artifact.
  - Define input contract, 6-role set, pipeline, DAG/wave execution rules, escalation triggers, fallback mode, and output contract.
- What must NOT change:
  - Do not alter production runtime behavior.
  - Do not require sub-agent runtime as mandatory; keep explicit fallback path.

## Repo Characteristic Fit (mandatory)
- Playbook must describe delegation boundaries for this repo:
  - default implementation target `canvas-editor-app/`
  - legacy root edits require explicit scope + patch-note awareness
  - vendor path is always read-only
- Gate command examples must use local scripts and local lint/build commands only.
- Playbook must explicitly state that it is supplemental; `AGENTS.md` remains authoritative.

## Execution dependencies (hard gate)
- Upstream prerequisites:
  - Task 004 must be `COMPLETED`.
  - Task 005 must be `COMPLETED`.
- Downstream handoff:
  - This task must leave explicit `AI_READ_ME.md` sync deltas for Task 008.

## Scope (Codex must touch ONLY these)
Touched files/directories:
- `codex_tasks/_PLAYBOOK_subagent_oneclick.md` (new)
- `codex_tasks/README.md`
- `codex_tasks/task_006_subagent_oneclick_playbook_port.md`

Out of scope:
- `AGENTS.md` and protocol wording updates (Tasks 004, 005)
- Any implementation in app source files

## Design Artifacts (required for layout/structure tasks)
- [ ] Layout/structure changes included: NO
- [ ] SVG path in `design_drafts/` (required if YES):
- [ ] SVG has explicit `viewBox` and ratio label
- [ ] Numeric redline resolved in spec

Note:
- SVG is structural draft only.
- SVG must not be embedded into production code.

## Dependencies / constraints
- New dependencies allowed: NO (default)
  - If YES, list and justify.
- Boundary rules:
  - Keep playbook informative, not authoritative over `AGENTS.md`.
  - Preserve Codex final decision authority across all delegated modes.
- Key guardrails:
  - no window globals in maintained area
  - no eval/new Function
  - sanitize external HTML inputs
  - JSON-safe persistence only
  - if legacy production files (`index.html`, `js/`, `css/`) are changed, update `PATCH_NOTES.txt`

## Speculative Defense Check
- [ ] Defensive branches added: NO
- If YES:
  - evidence (real case / source):
  - sunset criteria:

## Documentation Update Check
- [ ] Structure changed (file/folder add/move/delete):
  - run `bash scripts/gen_ai_read_me_map.sh`
  - verify `AI_READ_ME_MAP.md`
- [ ] Workflow/rule/semantic changes:
  - do not edit `AI_READ_ME.md` in this task
  - record sync deltas for Task 008 handoff

## Acceptance criteria (testable)
- [ ] AC-1: `codex_tasks/_PLAYBOOK_subagent_oneclick.md` exists and includes required sections: input contract, role set, pipeline, parallelism, escalation, fallback, output contract.
- [ ] AC-2: `codex_tasks/README.md` references the playbook and clarifies that task specs remain SSOT.
- [ ] AC-3: Playbook language explicitly preserves Codex final ownership and file ownership lock rules.
- [ ] AC-4: Playbook explicitly states it is supplemental to `AGENTS.md`, and output includes Task 008 sync handoff notes.

## Manual verification
1) Step:
   - Command / click path: `test -f codex_tasks/_PLAYBOOK_subagent_oneclick.md && rg -n "Input Contract|Role Set|Pipeline|Parallelism|Escalation|Fallback|Output Contract" codex_tasks/_PLAYBOOK_subagent_oneclick.md`
   - Expected: new playbook file exists with all required sections.
   - Covers: AC-1

2) Step:
   - Command / click path: `rg -n "_PLAYBOOK_subagent_oneclick.md|task specs" codex_tasks/README.md && rg -n "Codex remains final decision owner|file ownership lock" codex_tasks/_PLAYBOOK_subagent_oneclick.md`
   - Expected: README linkage and authority constraints are explicit.
   - Covers: AC-2, AC-3

## Risks / rollback
- Risks:
  - Playbook text can diverge from `AGENTS.md` and create process confusion.
- Rollback:
  - Remove playbook file and README reference, then reintroduce only after rule harmonization.

## Approval Gate
- [x] Spec self-reviewed by Codex
- [x] Explicit user approval received

Implementation must not start before this gate is satisfied (except approved hotfix path).

---

## Implementation Log
Status: COMPLETED
Changed files:
- `codex_tasks/_PLAYBOOK_subagent_oneclick.md`
- `codex_tasks/README.md`
- `codex_tasks/task_006_subagent_oneclick_playbook_port.md`

Commands run:
- `test -f codex_tasks/_PLAYBOOK_subagent_oneclick.md && rg -n "Input Contract|Role Set|Pipeline|Parallelism|Escalation|Fallback|Output Contract" codex_tasks/_PLAYBOOK_subagent_oneclick.md`
- `rg -n "_PLAYBOOK_subagent_oneclick.md|task specs" codex_tasks/README.md && rg -n "Codex remains final decision owner|file ownership lock" codex_tasks/_PLAYBOOK_subagent_oneclick.md`

Manual verification notes:
- Playbook file created with required sections and explicit supplemental authority note.
- README now links playbook while preserving `AGENTS.md` as authority SSOT.

Notes:
- Handoff to Task 008: add delegated one-click playbook summary and AGENTS-authority reminder into `AI_READ_ME.md`.
