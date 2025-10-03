# ABM Planning-stage ROI Calculator — Implementation Plan

_Last updated: 2025-09-18_

## 1. Architecture & Stack
- **Framework:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3.4, shadcn/ui (New York theme).
- **State management:** React server components + client segments; candidate for Zustand or Context when calculation state expands.
- **Formatting utilities:** custom helpers (currency, percentages, guardrails) colocated in `src/lib` with unit tests via Vitest.
- **Build tooling:** ESLint (Next profile), Turbopack dev/build, npm scripts. Add Vitest + Playwright as project matures.
- **Hosting (TBD):** Static export (Vercel/Netlify) once export strategy confirmed.

## 2. Milestone Breakdown

### Milestone A — Project Foundations (In progress)
- [x] Scaffold Next.js project with Tailwind + shadcn/ui baseline.
- [ ] Configure lint/test tooling (Vitest, Testing Library).
- [ ] Set up Git hooks (lint-staged) and CI recipe.
- [ ] Document environment setup (README update).

### Milestone B — Calculation Engine & Validation
- [ ] Model baseline, ABM and incremental calculations as pure functions (`src/lib/calculator`).
- [ ] Implement Zod schemas for inputs + default presets.
- [ ] Add guardrail logic (warnings vs blocking errors) with typed result structure.
- [ ] Unit tests covering representative scenarios, rounding rules and edge cases.

### Milestone C — Input Experience
- [ ] Build programme settings form with ramp/duration validation & tooltip copy.
- [ ] Build market & funnel inputs + inline guardrails.
- [ ] Build uplift & cost entry surfaces with derived totals.
- [ ] Introduce scenario presets and quick-reset controls.
- [ ] Keyboard and screen reader review for all controls.

### Milestone D — Results & Visualisation
- [ ] Bind calculation outputs to UI cards with loading/empty states.
- [ ] Implement footnotes and ROI explanation copy.
- [ ] Build sensitivity matrix (default 5×5) with heat-map styling and summary call-outs.
- [ ] Add validation banners/warnings for out-of-range inputs.

### Milestone E — Export & Sharing
- [ ] Implement XLSX export (SheetJS or similar) aligned with UI formatting.
- [ ] Implement PDF export (Playwright/Chromium or `@react-pdf`) with branded layout.
- [ ] Encode scenario state in URL (query/hash) and hydrate on load.
- [ ] Smoke-test cross-browser compatibility.

### Milestone F — Quality, Docs & Enablement
- [ ] Performance tuning (<150 ms recalculation, debounced inputs).
- [ ] Accessibility audit (Lighthouse score ≥ 90).
- [ ] Monitoring placeholder instrumentation (decide for v1).
- [ ] Draft strategist playbook + Loom walkthrough script.

## 3. Workstream Dependencies
- **Engine before UI binding:** UI cards depend on validated calculation utilities (Milestone B).
- **Exports after formatting utilities:** Number formatting + guardrails shared between UI and export pathways (Milestones B/C before E).
- **Scenario sharing depends on input schema stability:** finalize schema before encoding (Milestone C → E).

## 4. Open Decisions & Follow-ups
- Confirm hosting target and environment variables for exports.
- Agree on persistence roadmap (MVP is stateless; v1 adds auth/storage).
- Validate cost category list + copy with Strategy/Finance stakeholders.
- Align on telemetry deferral vs minimal logging (console or 3rd party).

## 5. Testing Strategy
- **Unit tests:** Calculation helpers, formatting utilities, guardrail conditions.
- **Component tests:** Critical form controls & output cards via Testing Library.
- **Visual regression (stretch):** Storybook/Chromatic once UI stabilises.
- **Manual QA checklist:** Cross-browser smoke, accessibility, export parity, performance timings.

