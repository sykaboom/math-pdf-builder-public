# Task 009: Workflow Transplant Consistency Gate (Repo-local)

Status: COMPLETED
Owner: Codex
Target: docs-only
Date: 2026-02-12

## Goal
- What to change:
  - Run a final consistency pass across transplanted workflow docs and resolve contradictions.
  - Produce a deterministic closeout checklist for future workflow edits in this repo.
- What must NOT change:
  - Do not add new governance rules beyond already approved transplant scope.
  - Do not edit runtime source code.

## Repo Characteristic Fit (mandatory)
- Consistency checks must validate that every workflow doc agrees on:
  - default implementation target (`canvas-editor-app/`)
  - legacy patch-note rule (`index.html`, `js/`, `css/`)
  - local guardrail scripts (`bash scripts/*.sh`)
  - vendor read-only boundary
- No `v10` references or `node scripts/gen_ai_read_me_map.mjs` references may remain in repo-governance docs.

## Execution dependencies (hard gate)
- Upstream prerequisites:
  - Task 004 must be `COMPLETED`.
  - Task 005 must be `COMPLETED`.
  - Task 006 must be `COMPLETED`.
  - Task 007 must be `COMPLETED`.
  - Task 008 must be `COMPLETED`.
- Start condition:
  - This task may not begin until all upstream prerequisites are complete.
- Completion contract:
  - Only contradiction fixes and harmonization edits are allowed.
  - Net-new governance rules are forbidden in this gate task.

## Scope (Codex must touch ONLY these)
Touched files/directories:
- `AGENTS.md`
- `GEMINI_CODEX_PROTOCOL.md`
- `AI_READ_ME.md`
- `AI_READ_ME_MAP.md`
- `codex_tasks/README.md`
- `codex_tasks/task_template.md`
- `codex_tasks/hotfix/hotfix_template.md`
- `codex_tasks/task_009_workflow_transplant_consistency_gate.md`

Out of scope:
- Existing completed historical task logs except for factual cross-check
- Application/runtime code

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
  - This task depends on completion of Tasks 004~008.
  - Only contradiction fixes and wording harmonization are allowed.
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
  - verify `AI_READ_ME.md`

## Acceptance criteria (testable)
- [ ] AC-1: No contradictions remain across `AGENTS.md`, `GEMINI_CODEX_PROTOCOL.md`, `AI_READ_ME.md`, and templates for core workflow terms (approval gate, delegated mode, fallback, escalation).
- [ ] AC-2: No disallowed foreign assumptions remain (`v10/`, `gen_ai_read_me_map.mjs`) in governance docs.
- [ ] AC-3: Final consistency checklist is documented for maintainers in `codex_tasks/README.md` or task template note.
- [ ] AC-4: Guardrail check script passes after documentation changes.
- [ ] AC-5: Task introduces no net-new governance policy beyond contradiction resolution.

## Manual verification
1) Step:
   - Command / click path: `rg -n "approval|delegated|fallback|escalation|spec-gated|hotfix" AGENTS.md GEMINI_CODEX_PROTOCOL.md AI_READ_ME.md codex_tasks/task_template.md codex_tasks/hotfix/hotfix_template.md`
   - Expected: shared terms are consistently defined without contradictory semantics.
   - Covers: AC-1

2) Step:
   - Command / click path: `rg -n "v10/|gen_ai_read_me_map\\.mjs" AGENTS.md GEMINI_CODEX_PROTOCOL.md AI_READ_ME.md codex_tasks/task_template.md codex_tasks/hotfix/hotfix_template.md codex_tasks/README.md`
   - Expected: no forbidden non-local assumptions remain.
   - Covers: AC-2

3) Step:
   - Command / click path: `bash scripts/check_guardrails.sh`
   - Expected: script exits successfully.
   - Covers: AC-4

4) Step:
   - Command / click path: `rg -n "^Status: COMPLETED" codex_tasks/task_004_agents_workflow_full_transplant.md codex_tasks/task_005_protocol_v5_alignment_transplant.md codex_tasks/task_006_subagent_oneclick_playbook_port.md codex_tasks/task_007_template_and_hotfix_workflow_transplant_localized.md codex_tasks/task_008_ai_readme_workflow_sync_localized.md`
   - Expected: all upstream tasks are completed before Task 009 closeout.
   - Covers: AC-1, AC-5

## Risks / rollback
- Risks:
  - Over-normalization may erase useful repo-specific nuance.
- Rollback:
  - Revert only conflicting harmonization edits and preserve last known coherent version.

## Approval Gate
- [x] Spec self-reviewed by Codex
- [x] Explicit user approval received

Implementation must not start before this gate is satisfied (except approved hotfix path).

---

## Implementation Log
Status: COMPLETED
Changed files:
- `AI_READ_ME_MAP.md`
- `codex_tasks/README.md`
- `codex_tasks/task_009_workflow_transplant_consistency_gate.md`

Commands run:
- `bash scripts/gen_ai_read_me_map.sh`
- `rg -n "approval|delegated|fallback|escalation|spec-gated|hotfix" AGENTS.md GEMINI_CODEX_PROTOCOL.md AI_READ_ME.md codex_tasks/task_template.md codex_tasks/hotfix/hotfix_template.md`
- `rg -n "v10/|gen_ai_read_me_map\\.mjs" AGENTS.md GEMINI_CODEX_PROTOCOL.md AI_READ_ME.md codex_tasks/task_template.md codex_tasks/hotfix/hotfix_template.md codex_tasks/README.md`
- `bash scripts/check_guardrails.sh`
- `rg -n "^Status: COMPLETED" codex_tasks/task_004_agents_workflow_full_transplant.md codex_tasks/task_005_protocol_v5_alignment_transplant.md codex_tasks/task_006_subagent_oneclick_playbook_port.md codex_tasks/task_007_template_and_hotfix_workflow_transplant_localized.md codex_tasks/task_008_ai_readme_workflow_sync_localized.md`

Manual verification notes:
- Core workflow terms are aligned across AGENTS/protocol/AI_READ_ME/templates.
- No disallowed foreign assumptions remain in governance docs.
- Upstream task completion gate (004~008) is satisfied.
- Guardrail check passes.

Notes:
- Consistency gate applied as harmonization-only; no runtime code and no new dependency/policy surface introduced.
- `AI_READ_ME_MAP.md` refreshed to reflect new workflow file additions from prior tasks.
