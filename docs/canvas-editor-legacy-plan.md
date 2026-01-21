# Canvas-Editor Legacy Feature Integration Plan

## Goals
- Port legacy math exam editor features into the Canvas-Editor app.
- Keep rules (header/footer/tag syntax) fully customizable by users.
- Follow PROJECT_BLUEPRINT constraints for isolation, data safety, and maintainability.

## Non-Goals (Initial)
- Pixel-perfect parity with the legacy UI on day one.
- Rewriting the Canvas-Editor engine core (only extend via adapters/plugins).

## Key Dependencies
- `canvas-editor-app/` as the React shell.
- `vendor/canvas-editor/` local source for offline development.
- Legacy reference: root `index.html` + `js/` modules.

## Feature Inventory (Legacy)
- Document structure: pages, columns, headers/footers, TOC, theme settings.
- Content blocks: text, math, concept blanks, images, tables, choice layouts.
- Editing UX: context menus, inline edit modals, keyboard shortcuts.
- Import/export: AI input parser, JSON/MSK, image assets, zip packaging.
- Rendering: math rendering, placeholders, print preflight.
- History: undo/redo, copy/duplicate, block split/merge.

## Rules Customization (Open Configuration)
Design a rule pack that lives outside the UI:
- `rules/schema.json`: JSON schema for tags, templates, and defaults.
- `rules/default.json`: default tag rules (legacy-compatible).
- `rules/overrides.json`: user overrides or custom rule packs.
- `core/rules` loader merges rules with validation and versioning.

The UI only edits rule packs, not internal logic. Core consumes rule packs.

## Integration Strategy
1) Core-first: Build/validate the core model and rules engine.
2) Adapter-first: Bridge core commands/events to Canvas-Editor.
3) UI-first: Build UI shells that map to core commands.

## Milestones
M0: Baseline Canvas-Editor boot
- Load engine reliably (vendor fallback).
- Minimal document render and selection.

M1: Document model + layout
- Page size, margins, columns.
- Header/footer templates (static first).

M2: Rules engine + parser
- AI tag parsing and normalization.
- External rule packs with validation.

M3: Core block types
- Text blocks with inline math tokens.
- Concept blanks and generic blank placeholders.
- Image placeholders and insertion hooks.
- Table and choice layout data models.

M4: Editing and commands
- Insert/delete/duplicate blocks.
- Context menu actions mapped to core commands.
- Undo/redo wired to core history.

M5: UI parity pass
- Toolbar + sidebar actions.
- Find/replace and edit modals.
- Zoom and view controls.

M6: File I/O and export
- Load/save JSON and MSK.
- Image asset packaging and recovery.
- Print/preflight checks.

M7: Regression and hardening
- Document schema validation on load.
- Sanitized rendering of any HTML-like content.
- Error recovery and telemetry hooks (local).

## Parallel Work Split
- Codex: core rules, parsers, data model, adapters, file I/O.
- Gemini: UI layout, panels, interaction design, responsive behavior.
- Shared: command list and event payloads.

## Acceptance Criteria
- Core runs without DOM.
- Tag rules can be changed without code edits.
- Legacy documents load and render (with documented gaps).
- All imports validated; unsafe content sanitized.

## Known Risks
- Canvas-Editor gaps for tables or complex layouts.
- Performance with large documents.
- Rule pack drift from legacy behavior.
