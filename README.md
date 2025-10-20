# ABM Planning-stage ROI Calculator

Strategic ABM’s planning-stage ROI calculator quantifies baseline versus ABM scenarios so programme leads can defend investment, gauge coverage guardrails, and share client-ready economics in minutes.

## Feature Highlights
- Multi-mode planner guiding teams through setup, tuning, and presentation views in a single flow.
- Guided onboarding coach and inline tooltips that explain every field before teams commit numbers.
- Auto-derived in-market share, capacity guardrails, and tier presets that keep assumptions realistic.
- Baseline vs ABM scoreboard with ROI, payback, incremental wins, and benchmark badges.
- Detailed drawer with conversion breakdown plus an ROI sensitivity heatmap for stakeholder reviews.

## Tech Stack
- Next.js 15 App Router with Turbopack-powered dev and build pipelines.
- React 19 with TypeScript and Tailwind CSS for composable, themeable UI.
- shadcn/ui components layered on Radix primitives for accessible form controls.
- React Hook Form and Zod schemas for constraint-based validation and defaults.
- Vitest unit suite covering calculator logic and guardrail behaviour.

## Getting Started

Ensure Node.js 20+ and npm 10+ are available. Install dependencies and launch the dev server:

```bash
npm install
npm run dev
```

Visit http://localhost:3000 to open the planner UI.

## Scripts
- `npm run dev` – Start the interactive development server with Turbopack.
- `npm run build` – Produce an optimized production build.
- `npm run start` – Serve the production build locally.
- `npm run lint` – Run ESLint using the Next.js profile.
- `npm run test` – Execute the Vitest suite in watch mode.
- `npm run test:coverage` – Generate Vitest coverage output.

## Core Modules
- `src/app` – Next.js routes, including the main planner and `/glossary` reference.
- `src/components` – Client components such as the scenario planner, sliders, and shadcn/ui wrappers.
- `src/lib/calculator` – Pure calculation engine, schema definitions, and Vitest coverage.
- `src/lib` – Formatting helpers, coverage derivations, and in-market mathematics.
- `docs` – Planning notes and implementation roadmap for upcoming milestones.

## Planner Workflow
- Setup mode walks through programme, market, and budget capacity inputs with validation guardrails.
- Tune mode unlocks presets, auto in-market derivation, and manual overrides for advanced modelling.
- Present mode highlights ROI scoreboard metrics with badges for ROI, ROMI, payback, and capacity health.
- The drawer reveals full baseline vs ABM comparisons plus a sensitivity heatmap across in-market and win-rate uplifts.
- An optional coach overlay and dedicated glossary help new users understand terminology quickly.

## Testing & Quality
- Core calculators are covered by `src/lib/calculator/calculator.test.ts`; extend with additional cases as guardrails expand.
- Use `npm run lint` before committing to keep UI and calculation modules aligned with project conventions.
- Accessibility and performance improvements are tracked in `docs/implementation-plan.md` Milestone F.
- Planned export and scenario sharing workstreams are documented in the same implementation plan for future releases.

## Additional Resources
- `docs/implementation-plan.md` – Detailed roadmap, milestones, and open decisions.
- `src/app/glossary/page.tsx` – In-app glossary content surfaced from the planner footer.
- `abm_planning_stage_roi_calculator_prd_draft.md` – Product requirement draft for context.
- `img/` and `public/` – Brand assets (logos, favicons) used across the UI.
