# GEMINI_CODEX_PROTOCOL.md (v5 - Codex-led, SVG-specialized Gemini)

## 0) Purpose (authoritative)
This protocol defines asymmetric collaboration for this repository.

- Codex is the single owner of task specs, implementation, validation, and closeout.
- Gemini is used only for spatial/layout reasoning through SVG drafts.
- This file does not override higher-authority repo documents.

Authority order (SSOT):
1. `PROJECT_BLUEPRINT.md`
2. `AI_READ_ME.md`
3. Approved task spec in `codex_tasks/`
4. `GEMINI_CODEX_PROTOCOL.md`
5. `AGENTS.md`
6. Ad-hoc chat instructions

## 1) Role Detection (strict)
Role is determined only by CLI identity.

- Codex CLI -> Codex (Spec Owner / Reviewer / Implementer / Validator)
- Gemini CLI -> Gemini (Layout / Spatial Assistant)

Tool access or user preference does not change role identity.

## 2) Repo Reality (factual)
- Legacy production app: root `index.html`, `js/`, `css/`
- Active migration app: `canvas-editor-app/`
- Reference app: `canvas-app/`
- Vendor source (read-only): `vendor/canvas-editor/canvas-editor-main/`
- Task SSOT: `codex_tasks/`
- Layout draft-only area: `design_drafts/`

Unless a spec explicitly states otherwise, implementation target is `canvas-editor-app/`.

## 3) Responsibilities (asymmetric)
### Codex
Codex is the only actor that may:
- author and lock task specs
- approve scope for execution
- implement production/document changes
- run verification gates
- finalize completion state (`COMPLETED`)

Codex must:
- follow spec-gated execution
- touch only approved scope files
- avoid speculative scope expansion

### Gemini
Gemini may:
- create SVG layout drafts under `design_drafts/`
- provide spatial constraints and structure annotations

Gemini must not:
- own task specs
- approve/reject implementation
- finalize execution status
- edit production code

## 4) SVG Layout Handoff (Gemini -> Codex)
For layout/structure tasks:
1. Gemini drafts SVG in `design_drafts/`.
2. Codex records numeric redlines in task spec.
3. Gemini performs one revision pass.
4. Codex freezes structure and implements.

Requirements:
- SVG has explicit `viewBox` and ratio label.
- SVG is design artifact only and must not be embedded as production asset.

## 5) Tablet Ink Layout Loop (layout tasks)
Required viewports:
- 768 x 1024
- 820 x 1180
- 1024 x 768
- 1180 x 820

Rules:
- Writing continuity over visual polish
- Overlay/panel must not block pointer path unexpectedly
- Close/recover controls must be immediately reachable
- Coordinate conflicts must be resolved before implementation

## 6) Sub-agent Assisted Execution (Codex-controlled)
Baseline 6-role model:
- Spec-Writer
- Spec-Reviewer
- Implementer-A
- Implementer-B
- Implementer-C
- Reviewer+Verifier

Rules:
- Codex keeps final authority for spec lock, merge decision, and completion.
- Reviewer+Verifier is one pass only.
- File ownership lock is mandatory in parallel branches.
- Conflicting ownership forces sequential fallback for affected scope.
- Parallel execution follows DAG + wave planning (baseline concurrency 6).

Escalation to user required when:
- breaking change
- new dependency
- security or cost policy impact
- data migration requirement
- layout task needs Gemini SVG draft request

Fallback:
- if sub-agent runtime is unavailable, continue single-Codex execution with same gates.

## 7) Spec-gated Workflow (Codex-led)
1. Spec Write (`PENDING`) in `codex_tasks/`
2. Spec Self-Review (scope/AC/rollback/speculative defense)
3. Approval Gate (manual approval or active delegated window)
4. Implementation (approved scope only)
5. Closeout in same spec (`COMPLETED`, changed files, commands, verification)

## 8) Hotfix Exception
- Allowed only with explicit user approval.
- Must log under `codex_tasks/hotfix/`.
- Hotfix does not transfer ownership away from Codex.

## 9) Evidence Rule (anti-hallucination)
- Do not assert repository facts without evidence.
- Evidence format:
  - `path` + short quoted snippet or command result reference
- If evidence is missing:
  - state `Unknown`
  - request exact file/path before claiming facts

## 10) Guardrails and Safety
- Use local guardrail scripts:
  - `bash scripts/check_guardrails.sh` during edit batches
  - `bash scripts/guardrails.sh` before commit/push
- No `eval` / `new Function`
- No new `window` globals in maintained area
- No unsafe HTML sinks in maintained area
- Vendor path stays read-only
- Legacy production edits require patch-note update (`PATCH_NOTES.txt`)

## 11) Binding Summary
- Codex owns spec, execution, verification, and closeout.
- Gemini is SVG/layout specialized only.
- Parallelism is execution optimization, not decision ownership.
