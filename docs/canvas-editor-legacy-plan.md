# Canvas-Editor Legacy Migration Plan (Session-Aligned)

Date: 2026-02-07  
Target app: `canvas-editor-app/`

## Context from this session
- `canvas-editor-app` is the active implementation target.
- `canvas-app` (Univer PoC) is kept as comparison/reference, not the primary migration target.
- We optimize for long-term interoperability with v10 and MCP-based tool pipeline.
- Legacy compatibility is optional, not mandatory.

## Primary Goal
Build AI-first authoring capability in `canvas-editor-app` without creating a spaghetti migration path.

## Non-goals (current phase)
- Full visual parity in one shot.
- Rewriting Canvas-Editor vendor core in this repo.
- Direct model/provider-specific parsing logic in editor core.

## Migration Rules
1. Exchange direction is aligned, but schema freeze is deferred:
   - keep payload shape close to `NormalizedContent` style
   - finalize versions after real feature maturity in both apps
2. Tool output is standardized:
   - `ToolResult` -> normalize -> `NormalizedContent` -> editor adapter.
3. Legacy compatibility is optional:
   - provide one-shot import tooling only if migration value is clear.
4. Vendor source is read-only:
   - behavior changes go through wrapper/adapters.

## Legacy Feature Domains
- Layout: page size, margins, headers/footers, columns, breaks
- Block model: text, math, blank/concept blank, image, table, choices
- Authoring UX: commands, shortcuts, context actions
- Data IO: json/msk, asset packaging, import/export
- Validation: schema checks, sanitize, preflight

## Data Flow (target)
1. AI/tool import:
   - MCP/API tool -> `ToolResult` -> normalizer -> `NormalizedContent` -> editor model
2. Export:
   - editor model -> `NormalizedContent` (exchange)
3. Optional migration import:
   - legacy json/msk -> migration tool -> normalized payload -> editor model

## Milestones

### M0. Stability baseline
- Keep `canvas-editor-app` boot stable.
- Guardrail scripts green.

### M1. Contract adapters
- Implement minimal normalized payload conversion:
  - `ToolResult`/AI output -> normalized payload
  - normalized payload -> editor seed data
- Keep as draft contract; collect mismatch feedback before freeze.

### M2. Block domain migration
- M2-1 text/math
- M2-2 blanks/concept blanks
- M2-3 image/table
- Each sub-step is validated against AI-first authoring scenarios.

### M3. Layout domain migration
- Headers/footers/page/column behavior moved behind commands/adapters.
- Keep page-level behavior deterministic.

### M4. Tool pipeline hookup
- Add ingestion boundary for MCP/API results through `ToolResult`.
- Block direct provider parsing in feature code.

### M5. Legacy parity gate
- Legacy parity is not a gate.
- Use capability gates based on current product scenarios and AI workflow readiness.

## Acceptance Criteria
- AI/tool ingest path uses `ToolResult` and `NormalizedContent`.
- No vendor edits required for migrated features.
- Guardrail checks pass during implementation cycles.
- Contract freeze decision is explicitly deferred until feature maturity checkpoint.

## Known Risks
- Complex layout behavior may require staged fallback.
- Legacy HTML-heavy edge cases can reintroduce unsafe paths.
- Contract updates across repos can drift without version discipline.
- Removing legacy compatibility may block a subset of old documents.
