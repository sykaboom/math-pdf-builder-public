# Task 008: AI_READ_ME Workflow Sync (Localized Transplant)

Status: COMPLETED
Owner: Codex
Target: docs-only
Date: 2026-02-12

## Goal
- What to change:
  - Update `AI_READ_ME.md` to reflect the transplanted workflow model after Tasks 004~007.
  - Ensure read order, execution loop, delegated mode notes, and fallback behavior are aligned with this repository’s authoritative docs.
- What must NOT change:
  - Do not replace `PROJECT_BLUEPRINT.md` as top architecture authority.
  - Do not add non-local command flows or foreign repository assumptions.

## Repo Characteristic Fit (mandatory)
- Keep “Project zones” aligned to:
  - legacy root (`index.html`, `js/`, `css/`)
  - active migration app (`canvas-editor-app/`)
  - reference app (`canvas-app/`)
  - vendor read-only path
- Keep guardrail timing commands as local shell scripts only.
- If workflow semantics change, explicitly document fallback behavior when sub-agent runtime is unavailable.

## Execution dependencies (hard gate)
- Upstream prerequisites:
  - Task 004 must be `COMPLETED`.
  - Task 005 must be `COMPLETED`.
  - Task 006 must be `COMPLETED`.
  - Task 007 must be `COMPLETED`.
- Completion contract:
  - Resolve and merge all documented sync deltas handed off from Tasks 004~007.

## Scope (Codex must touch ONLY these)
Touched files/directories:
- `AI_READ_ME.md`
- `codex_tasks/task_008_ai_readme_workflow_sync_localized.md`

Out of scope:
- `AI_READ_ME_MAP.md` regeneration unless file/folder structure changes
- Runtime source changes

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
  - AI_READ_ME summarizes; it must not contradict `AGENTS.md` or `GEMINI_CODEX_PROTOCOL.md`.
  - Keep documentation concise but operationally complete.
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
  - verify `AI_READ_ME.md` has no contradictions with `AGENTS.md` and `GEMINI_CODEX_PROTOCOL.md`

## Acceptance criteria (testable)
- [ ] AC-1: `AI_READ_ME.md` read order references current authoritative files and task SSOT correctly.
- [ ] AC-2: `AI_READ_ME.md` includes transplanted workflow semantics (spec-gated loop, delegated mode summary, fallback mode).
- [ ] AC-3: Guardrail timing and zone boundaries remain local-repo accurate.
- [ ] AC-4: `AI_READ_ME.md` does not introduce path/tooling assumptions outside this repo.
- [ ] AC-5: All handoff deltas from Tasks 004~007 are resolved and traceable in this task log.

## Manual verification
1) Step:
   - Command / click path: `rg -n "Read order|spec-gated|delegated|fallback|Task SSOT" AI_READ_ME.md`
   - Expected: workflow summary is aligned with transplanted model.
   - Covers: AC-1, AC-2

2) Step:
   - Command / click path: `rg -n "canvas-editor-app|canvas-app|index.html|js/|css/|vendor/canvas-editor/canvas-editor-main|bash scripts/" AI_READ_ME.md`
   - Expected: local zone/command mapping is preserved.
   - Covers: AC-3, AC-4

3) Step:
   - Command / click path: `rg -n "^Status: COMPLETED" codex_tasks/task_004_agents_workflow_full_transplant.md codex_tasks/task_005_protocol_v5_alignment_transplant.md codex_tasks/task_006_subagent_oneclick_playbook_port.md codex_tasks/task_007_template_and_hotfix_workflow_transplant_localized.md`
   - Expected: all upstream task statuses are `COMPLETED` before this task closes.
   - Covers: AC-5

## Risks / rollback
- Risks:
  - Drift between AI_READ_ME summary and authoritative docs.
- Rollback:
  - Revert AI_READ_ME and re-sync from AGENTS/protocol after conflict resolution.

## Approval Gate
- [x] Spec self-reviewed by Codex
- [x] Explicit user approval received

Implementation must not start before this gate is satisfied (except approved hotfix path).

---

## Implementation Log
Status: COMPLETED
Changed files:
- `AI_READ_ME.md`
- `codex_tasks/task_008_ai_readme_workflow_sync_localized.md`

Commands run:
- `rg -n "Read order|spec-gated|delegated|fallback|Task SSOT" AI_READ_ME.md`
- `rg -n "canvas-editor-app|canvas-app|index.html|js/|css/|vendor/canvas-editor/canvas-editor-main|bash scripts/" AI_READ_ME.md`
- `rg -n "v10/|gen_ai_read_me_map\\.mjs" AI_READ_ME.md`
- `rg -n "^Status: COMPLETED" codex_tasks/task_004_agents_workflow_full_transplant.md codex_tasks/task_005_protocol_v5_alignment_transplant.md codex_tasks/task_006_subagent_oneclick_playbook_port.md codex_tasks/task_007_template_and_hotfix_workflow_transplant_localized.md`

Manual verification notes:
- `AI_READ_ME.md` now reflects delegated workflow, fallback model, and repo-local zone/guardrail rules.
- Upstream tasks 004~007 are confirmed completed before Task 008 closeout.
- No foreign path assumptions (`v10/`, `gen_ai_read_me_map.mjs`) detected in `AI_READ_ME.md`.

Notes:
- Resolved handoff deltas from Tasks 004~007:
  - AGENTS delegated/escalation/fallback summary synced
  - protocol evidence rule and role strictness synced
  - playbook supplemental-authority rule synced
  - template/hotfix reporting expectations synced
