# Task 004: AGENTS Workflow Full Transplant (SY-Math-Slate -> math-pdf-builder)

Status: COMPLETED
Owner: Codex
Target: docs-only
Date: 2026-02-12

## Goal
- What to change:
  - Upgrade `AGENTS.md` to fully match the SY-Math-Slate workflow model, adapted to this repository paths/scripts.
  - Add missing execution governance: delegated mode, 6-role baseline, escalation policy, fallback policy, tablet layout governance, and forward-compatibility invariants.
- What must NOT change:
  - Do not change runtime/editor code in `canvas-editor-app/`, `canvas-app/`, or legacy production files.
  - Do not import foreign path assumptions (`v10/`, `node scripts/gen_ai_read_me_map.mjs`).

## Repo Characteristic Fit (mandatory)
- Active implementation zone remains `canvas-editor-app/` by default.
- Legacy production zone (`index.html`, `js/`, `css/`) remains maintenance-only and tied to patch-note rule.
- Guardrail command set remains shell-based:
  - `bash scripts/scan_guardrails.sh`
  - `bash scripts/check_guardrails.sh`
  - `bash scripts/guardrails.sh`
- AI map freshness remains repo-local shell script:
  - `bash scripts/gen_ai_read_me_map.sh`

## Execution dependencies (hard gate)
- Upstream prerequisites:
  - none (first task in transplant chain)
- Downstream handoff:
  - This task must leave explicit `AI_READ_ME.md` sync deltas for Task 008.

## Scope (Codex must touch ONLY these)
Touched files/directories:
- `AGENTS.md`
- `codex_tasks/task_004_agents_workflow_full_transplant.md`

Out of scope:
- `GEMINI_CODEX_PROTOCOL.md` text migration (handled by Task 005)
- `AI_READ_ME.md` synchronization (handled by Task 008)
- Production source code changes

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
  - Keep repository-local sections intact (`Repository Reality`, guardrail scripts, legacy patch rule).
  - Keep Codex single-owner authority model.
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
- [ ] AC-1: `AGENTS.md` defines one-click delegated execution mode with explicit 6-role baseline and file ownership lock rules.
- [ ] AC-2: `AGENTS.md` defines escalation conditions and fallback mode for unavailable sub-agent runtime.
- [ ] AC-3: `AGENTS.md` includes tablet ink governance viewports and forward-compatibility invariants.
- [ ] AC-4: `AGENTS.md` keeps this repo local constraints (active target `canvas-editor-app/`, guardrail scripts, legacy patch rule).
- [ ] AC-5: Task output includes explicit handoff notes for Task 008 (`AI_READ_ME.md` synchronization points).

## Manual verification
1) Step:
   - Command / click path: `rg -n "One-click Delegated Execution Mode|Required 6-role set|Escalation conditions|Fallback|Tablet Ink UX Governance|Forward Compatibility Invariants" AGENTS.md`
   - Expected: all required governance sections are present.
   - Covers: AC-1, AC-2, AC-3

2) Step:
   - Command / click path: `rg -n "canvas-editor-app|scan_guardrails.sh|check_guardrails.sh|guardrails.sh|index.html|js/|css/" AGENTS.md`
   - Expected: repository-local execution constraints remain present.
   - Covers: AC-4

## Risks / rollback
- Risks:
  - Over-porting could accidentally reintroduce non-local assumptions.
  - Stronger rules could increase operational overhead for small changes.
- Rollback:
  - Revert `AGENTS.md` to previous commit state and keep only repo-proven sections.

## Approval Gate
- [x] Spec self-reviewed by Codex
- [x] Explicit user approval received

Implementation must not start before this gate is satisfied (except approved hotfix path).

---

## Implementation Log
Status: COMPLETED
Changed files:
- `AGENTS.md`
- `codex_tasks/task_004_agents_workflow_full_transplant.md`

Commands run:
- `cat canvas-editor-app/package.json`
- `rg -n "One-click Delegated Execution Mode|Required 6-role set|Escalation conditions|Fallback|Tablet Ink UX Governance|Forward Compatibility Invariants" AGENTS.md`
- `rg -n "canvas-editor-app|scan_guardrails.sh|check_guardrails.sh|guardrails.sh|index.html|js/|css/" AGENTS.md`
- `rg -n "v10/|gen_ai_read_me_map\\.mjs" AGENTS.md`

Manual verification notes:
- Required governance sections present and repo-local constraints retained.
- No foreign path assumptions (`v10/`, `gen_ai_read_me_map.mjs`) detected in `AGENTS.md`.

Notes:
- Handoff to Task 008: sync `AI_READ_ME.md` with new delegated execution, escalation/fallback, and forward-compatibility sections added in `AGENTS.md`.
