# Task 007: Task/Hotfix Template Workflow Transplant (Localized)

Status: COMPLETED
Owner: Codex
Target: docs-only
Date: 2026-02-12

## Goal
- What to change:
  - Upgrade `codex_tasks/task_template.md` and `codex_tasks/hotfix/hotfix_template.md` to fully support transplanted workflow operations.
  - Add missing template fields for delegated mode, escalation classification, gate results, and repo-characteristic constraints.
- What must NOT change:
  - Do not enforce non-local tooling or v10-specific command paths.
  - Do not loosen existing safety constraints already in this repo.

## Repo Characteristic Fit (mandatory)
- Template targets must remain local:
  - `canvas-editor-app/`
  - `root-legacy/`
  - `docs-only`
- Script references must remain:
  - `bash scripts/scan_guardrails.sh`
  - `bash scripts/check_guardrails.sh`
  - `bash scripts/guardrails.sh`
  - `bash scripts/gen_ai_read_me_map.sh`
- Legacy patch note linkage must remain explicit for `index.html`, `js/`, `css/`.

## Execution dependencies (hard gate)
- Upstream prerequisites:
  - Task 004 must be `COMPLETED`.
  - Task 005 must be `COMPLETED`.
- Parallelism note:
  - Task 006 and Task 007 may run in parallel after upstream prerequisites are satisfied.
- Downstream handoff:
  - This task must leave explicit `AI_READ_ME.md` sync deltas for Task 008.

## Scope (Codex must touch ONLY these)
Touched files/directories:
- `codex_tasks/task_template.md`
- `codex_tasks/hotfix/hotfix_template.md`
- `codex_tasks/task_007_template_and_hotfix_workflow_transplant_localized.md`

Out of scope:
- Existing individual task specs except as references
- Runtime source code changes

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
  - Task template must stay compatible with `AGENTS.md` authority and gates.
  - Hotfix template must remain short and urgent-focused.
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
- [ ] AC-1: `codex_tasks/task_template.md` includes delegated/manual mode and explicit approval gates.
- [ ] AC-2: Template includes gate result classification (`pre-existing` vs `new`, `blocking` vs `non-blocking`).
- [ ] AC-3: Template keeps repo-local command/script references only.
- [ ] AC-4: `codex_tasks/hotfix/hotfix_template.md` includes user hotfix approval evidence + follow-up linkage to full task when needed.
- [ ] AC-5: Task output includes explicit handoff notes for Task 008 (`AI_READ_ME.md` synchronization points).

## Manual verification
1) Step:
   - Command / click path: `rg -n "Execution mode|Approval Gate|Failure Classification|pre-existing|newly introduced|blocking" codex_tasks/task_template.md`
   - Expected: upgraded governance fields are present.
   - Covers: AC-1, AC-2

2) Step:
   - Command / click path: `rg -n "bash scripts/scan_guardrails.sh|bash scripts/check_guardrails.sh|bash scripts/guardrails.sh|bash scripts/gen_ai_read_me_map.sh|canvas-editor-app|root-legacy" codex_tasks/task_template.md`
   - Expected: local references only.
   - Covers: AC-3

3) Step:
   - Command / click path: `rg -n "User approval|Follow-up|full task spec|hotfix" codex_tasks/hotfix/hotfix_template.md`
   - Expected: hotfix proof and follow-up fields exist.
   - Covers: AC-4

## Risks / rollback
- Risks:
  - Overly heavy template can reduce small-task speed.
- Rollback:
  - Revert templates and split heavy fields into optional sections.

## Approval Gate
- [x] Spec self-reviewed by Codex
- [x] Explicit user approval received

Implementation must not start before this gate is satisfied (except approved hotfix path).

---

## Implementation Log
Status: COMPLETED
Changed files:
- `codex_tasks/task_template.md`
- `codex_tasks/hotfix/hotfix_template.md`
- `codex_tasks/task_007_template_and_hotfix_workflow_transplant_localized.md`

Commands run:
- `rg -n "Execution mode|Approval Gate|Failure Classification|pre-existing|newly introduced|blocking" codex_tasks/task_template.md`
- `rg -n "bash scripts/scan_guardrails.sh|bash scripts/check_guardrails.sh|bash scripts/guardrails.sh|bash scripts/gen_ai_read_me_map.sh|canvas-editor-app|root-legacy" codex_tasks/task_template.md`
- `rg -n "User hotfix approval reference|Follow-up|full task spec|hotfix" codex_tasks/hotfix/hotfix_template.md`

Manual verification notes:
- Task template now contains delegated/manual planning, approval gate, gate results, and failure classification fields.
- Template and hotfix template retain repo-local script/path assumptions and explicit hotfix approval evidence field.

Notes:
- Handoff to Task 008: sync `AI_READ_ME.md` with new template workflow fields (execution mode, guardrail timing, and failure classification reporting).
