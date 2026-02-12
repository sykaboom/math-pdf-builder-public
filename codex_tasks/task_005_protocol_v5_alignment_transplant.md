# Task 005: GEMINI_CODEX_PROTOCOL v5 Alignment Transplant

Status: COMPLETED
Owner: Codex
Target: docs-only
Date: 2026-02-12

## Goal
- What to change:
  - Upgrade `GEMINI_CODEX_PROTOCOL.md` from simplified v2 shape to SY-Math-Slate v5-level workflow protocol.
  - Preserve asymmetric ownership: Codex owns specs/implementation/validation, Gemini is SVG-layout specialized only.
  - Add strict role detection, sub-agent assisted execution governance, anti-hallucination evidence rule, and binding summary.
- What must NOT change:
  - Do not weaken Codex authority model.
  - Do not introduce any production code instructions or non-local path assumptions.

## Repo Characteristic Fit (mandatory)
- Protocol repo map must reference this repo zones only:
  - active migration app `canvas-editor-app/`
  - legacy production root `index.html`, `js/`, `css/`
  - reference app `canvas-app/`
  - vendor read-only `vendor/canvas-editor/canvas-editor-main/`
- Any script references must use local shell wrappers under `scripts/`.
- No `v10` folder assumptions may be introduced.

## Execution dependencies (hard gate)
- Upstream prerequisites:
  - Task 004 must be `COMPLETED`.
- Downstream handoff:
  - This task must leave explicit `AI_READ_ME.md` sync deltas for Task 008.

## Scope (Codex must touch ONLY these)
Touched files/directories:
- `GEMINI_CODEX_PROTOCOL.md`
- `codex_tasks/task_005_protocol_v5_alignment_transplant.md`

Out of scope:
- `AGENTS.md` edits (Task 004)
- `AI_READ_ME.md` sync (Task 008)
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
  - Keep authority order coherent with this repo SSOT.
  - Preserve local repository map (`canvas-editor-app/`, `canvas-app/`, legacy root, vendor read-only).
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
- [ ] AC-1: `GEMINI_CODEX_PROTOCOL.md` includes strict role detection and asymmetric Codex/Gemini responsibilities.
- [ ] AC-2: Protocol includes spec-gated loop + delegated execution governance (role set, escalation, fallback).
- [ ] AC-3: Protocol includes SVG handoff requirements, tablet layout loop constraints, and anti-hallucination evidence rule.
- [ ] AC-4: Protocol remains repo-local and consistent with `AGENTS.md` authority intent.
- [ ] AC-5: Task output includes explicit handoff notes for Task 008 (`AI_READ_ME.md` synchronization points).

## Manual verification
1) Step:
   - Command / click path: `rg -n "Role detection|Responsibilities|Spec-gated Workflow|Sub-agent Assisted Execution|Escalation|required|Fallback|Anti-hallucination|Binding Summary" GEMINI_CODEX_PROTOCOL.md`
   - Expected: all required governance sections exist.
   - Covers: AC-1, AC-2, AC-3

2) Step:
   - Command / click path: `rg -n "canvas-editor-app|canvas-app|index.html|vendor/canvas-editor/canvas-editor-main|design_drafts" GEMINI_CODEX_PROTOCOL.md`
   - Expected: repo-local realities are retained.
   - Covers: AC-4

## Risks / rollback
- Risks:
  - Conflicting wording with `AGENTS.md` can create authority ambiguity.
- Rollback:
  - Revert `GEMINI_CODEX_PROTOCOL.md` and re-apply only sections confirmed by `AGENTS.md`.

## Approval Gate
- [x] Spec self-reviewed by Codex
- [x] Explicit user approval received

Implementation must not start before this gate is satisfied (except approved hotfix path).

---

## Implementation Log
Status: COMPLETED
Changed files:
- `GEMINI_CODEX_PROTOCOL.md`
- `codex_tasks/task_005_protocol_v5_alignment_transplant.md`

Commands run:
- `rg -n "Role Detection|Responsibilities|Spec-gated Workflow|Sub-agent Assisted Execution|Escalation|Fallback|Evidence Rule|Binding Summary" GEMINI_CODEX_PROTOCOL.md`
- `rg -n "canvas-editor-app|canvas-app|index.html|vendor/canvas-editor/canvas-editor-main|design_drafts" GEMINI_CODEX_PROTOCOL.md`
- `rg -n "v10/|gen_ai_read_me_map\\.mjs" GEMINI_CODEX_PROTOCOL.md`

Manual verification notes:
- Required protocol sections are present and aligned to repo-local map and role boundaries.
- No disallowed foreign assumptions (`v10/`, `gen_ai_read_me_map.mjs`) detected.

Notes:
- Handoff to Task 008: sync `AI_READ_ME.md` with protocol updates (role detection strictness, sub-agent delegated flow, evidence rule, and fallback semantics).
