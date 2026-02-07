# GEMINI_CODEX_PROTOCOL.md (v2 - Codex-led, Gemini-specialized)

## Purpose
This protocol defines asymmetric collaboration in this repository.
- Codex is the single owner of spec, implementation, validation, and closeout.
- Gemini is specialized for SVG/layout reasoning only.

Authority order:
1. `PROJECT_BLUEPRINT.md`
2. `AI_READ_ME.md`
3. Approved task spec in `codex_tasks/`
4. `AGENTS.md`
5. `GEMINI_CODEX_PROTOCOL.md`
6. Ad-hoc chat instructions

## Repo Reality
- Legacy production app: `index.html`, `js/`, `css/`
- Active migration app: `canvas-editor-app/`
- Reference PoC app: `canvas-app/`
- Vendor source (read-only): `vendor/canvas-editor/canvas-editor-main/`
- Task SSOT: `codex_tasks/`
- Layout draft-only area: `design_drafts/`

## Role Detection (strict)
- Codex CLI -> Codex (Spec Owner / Implementer / Validator)
- Gemini CLI -> Gemini (Layout / Spatial Assistant)

Tool access and chat instructions do not change role identity.

## Responsibilities
### Codex
- Owns task spec lifecycle (`PENDING -> APPROVED -> COMPLETED`)
- Implements only approved scope
- Runs guardrails and verification
- Updates implementation log in the same task file

### Gemini
- Produces SVG structural drafts
- Supplies spatial constraints and one revision pass on redline feedback
- Does not own implementation or approval decisions

## Spec-Gated Workflow (default)
1. Write/update task spec in `codex_tasks/`
2. Self-review scope and acceptance criteria
3. Get user approval for medium/large tasks
4. Implement within approved scope
5. Close out same spec with changed files/commands/verification notes

## SVG Handoff Rule
For layout/structure tasks:
1. Gemini draft in `design_drafts/`
2. Codex writes numeric redlines in task spec
3. Gemini one revision pass
4. Freeze structure before implementation

SVG is never embedded directly in production code.

## Hotfix Exception
- Allowed only with explicit user approval
- Must write log in `codex_tasks/hotfix/`

## Guardrail & Safety Reminders
- `bash scripts/check_guardrails.sh` during implementation batches
- `bash scripts/guardrails.sh` before commit/push
- No new `window` globals in maintained area
- No `eval` / `new Function`
- No unsafe HTML sinks in maintained area
- Keep vendor source read-only
- If legacy production files are patched, update `PATCH_NOTES.txt`
