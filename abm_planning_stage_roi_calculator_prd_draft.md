# abm planning-stage roi calculator — product requirements document (prd)

**version:** 0.1 (draft)  
**owner:** strategy / product  
**date:** 18 september 2025  
**status:** for review

---

## summary
- build a lightweight calculator that estimates the incremental financial impact of an abm programme **at the planning stage**.  
- the tool compares **baseline vs with-abm** outcomes, models **incremental revenue and gross profit**, and computes **roi, break-even wins, and payback months**.  
- mvp will be a simple web app that reuses the same calculation engine; v1 will add scenario management and collaboration.

## goals
- help strategists quantify the economic case for abm before launch.  
- enable consistent assumptions, clear documentation of inputs, and fast scenario testing.  
- provide outputs that are **client-ready** and easy to export.  
- create a single set of **standardised formulas** to avoid bespoke spreadsheets for every engagement.

## non-goals
- multi-touch attribution or post-campaign measurement.  
- crm pipeline forecasting or sfdc data quality remediation.  
- predictive modelling beyond deterministic scenario maths.

## personas
- **abm strategist (primary):** designs programme, sets assumptions, runs scenarios, presents outputs.  
- **client lead / account director:** validates cost lines and narrative.  
- **client-side sponsor (vp marketing / sales leader):** reviews business case, interrogates assumptions.  
- **finance partner:** checks margin, revenue recognition, and payback framing.

## problem statement
- abm business cases are often inconsistent and time-consuming to produce; assumptions vary, costs are undercounted, and outputs lack comparability. a standard calculator provides repeatable, credible, and transparent planning economics.

---

## scope
- **in scope (mvp)**  
  - manual inputs for target account universe, in-market rate, opportunities per in-market account, baseline win rate and acv, contribution margin, sales cycle baseline vs with-abm, uplifts (win-rate in pp, acv, opportunity rate), ramp-up period, programme duration, and detailed cost lines.  
  - outputs: baseline vs abm tables, incremental revenue, incremental gross profit, roi, break-even wins, payback months, sensitivity grid (in-market × win-rate uplift).  
  - export to xlsx and pdf with a clean, branded layout.  
  - guardrails and validation on inputs with clear tooltips.  
- **out of scope (mvp)**  
  - live crm connections, lead routing, or personal data processing.  
  - attribution and post-campaign actuals.

## key assumptions
- abm influences three primary levers: **win rate (absolute pp), deal value (acv %), and opportunity rate (%).**  
- contribution margin approximates gross profit and is applied to recognised revenue.  
- payback months use a run-rate approximation accelerated by the **sales cycle velocity factor** (baseline cycle ÷ abm cycle).  
- programme costs include internal people, media, data/tech, content, partners/agency, and other.

---

## functional requirements

### inputs
- **programme settings**  
  - programme duration (months)  
  - ramp-up period (months) until steady-state impact  
  - currency and number formatting  
- **market and funnel**  
  - number of target accounts  
  - in-market rate (%)  
  - qualified opportunities per in-market account  
  - baseline win rate (%)  
  - baseline average deal value (acv)  
  - contribution margin (%)  
  - sales cycle (months) baseline and with abm  
- **uplifts from abm**  
  - win-rate uplift (absolute percentage points)  
  - acv uplift (%)  
  - opportunity-rate uplift (%)  
- **costs**  
  - people, media, data and tech, content, agency/partners, other  
  - derived **total programme cost**  
- **sensitivity settings**  
  - ranges for in-market rate and win-rate uplift  
  - optional custom matrix resolution (e.g., 5×5)

### calculations engine
- **baseline**  
  - in-market accounts = accounts × in-market rate  
  - qualified opportunities = in-market accounts × opportunities per in-market account  
  - expected wins = qualified opportunities × baseline win rate  
  - revenue = expected wins × acv  
  - gross profit = revenue × contribution margin  
- **with abm**  
  - qualified opportunities_abm = in-market accounts × opps per in-market × (1 + opportunity-rate uplift)  
  - expected wins_abm = qualified opportunities_abm × (baseline win rate + win-rate uplift)  
  - acv_abm = acv × (1 + acv uplift)  
  - revenue_abm = expected wins_abm × acv_abm  
  - gross profit_abm = revenue_abm × contribution margin  
- **incremental**  
  - incremental revenue = revenue_abm − revenue_baseline  
  - incremental gross profit = gross profit_abm − gross profit_baseline  
  - roi = (incremental gross profit − total programme cost) ÷ total programme cost  
  - break-even wins = ceil(total programme cost ÷ (acv_abm × contribution margin))  
  - payback months ≈ total programme cost ÷ ((incremental gross profit ÷ duration) × velocity factor) where velocity factor = sales cycle baseline ÷ sales cycle abm  
- **sensitivity**  
  - roi grid across user-defined arrays of in-market rate and win-rate uplift, holding other parameters constant.

### outputs
- **summary view**  
  - headline: incremental revenue, incremental gross profit, roi, payback months, break-even wins  
  - baseline vs abm table of the key metrics  
- **sensitivity view**  
  - heatmap table of roi for in-market × win-rate uplift  
  - optional export of the grid as an image for slides  
- **assumptions sheet**  
  - human-readable summary of all inputs with notes and rationale  
- **export**  
  - one-click pdf export with agency branding  
  - xlsx export of the model

### ux and interaction
- **flow**: inputs → outputs → sensitivity → export.  
- **validation**: soft limits with inline warnings (e.g., win-rate uplift cannot push total win rate above 100%).  
- **explainability**: tooltips next to each input describing its role and typical ranges.  
- **defaults**: sensible default values based on typical enterprise abm scenarios.  
- **accessibility**: keyboard-friendly and readable contrast.

### integrations and data
- **mvp**: manual inputs only; no pii stored.  
- **v1.1 (optional)**: import a csv of account list and costs; simple presets by abm tier (1:1, 1:few, 1:many).  
- **v1.2 (optional)**: read-only crm snapshots for baseline win rate and acv via csv upload.

### security and privacy
- no personal data required.  
- if web app is pursued: store scenarios server-side behind authentication; encrypt at rest and in transit; delete-on-request.

---

## technology & ux decisions (mvp)
- **frontend**: next.js (app router) + react + typescript; tailwind for styling; **shadcn/ui** as the component library; **lucide-react** for icons.
- **forms & validation**: react-hook-form + zod with inline errors and helper text; soft guardrails (warnings) and hard stops for impossible states (e.g., win rate > 100%).
- **calculation engine**: pure typescript module (no framework hooks) so it can be reused in other environments; deterministic, unit-tested; all numbers handled as decimals, not floats, to avoid rounding drift.
- **state & urls**: minimal client state; persist current scenario to the url querystring (copy/paste to share). no database for mvp.
- **number & currency formatting**: Intl.NumberFormat with `en-GB` locale and pound sterling by default; user-selectable currency in settings (format only; no fx in mvp).
- **charts**: recharts for the sensitivity heatmap and any simple charts; accessible svg with text labels.
- **export**: pdf via client-side print stylesheet (plus an api route fallback if needed); xlsx via SheetJS using the same numbers from the calculation engine.
- **accessibility**: wcag 2.2 aa targets; full keyboard support; visible focus; aria labels on all inputs; respects reduced motion.
- **theming**: light theme using strategic abm tokens encoded in shadcn theme.
  - **font stack**: sans-serif (e.g., Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif).
  - **colours**: bg.primary `#FFFFFF`; bg.inverse `#000000`; accent.cta `#E95A0B`; text.contrast `#3C3C3C`.
  - spacing and radii follow shadcn defaults unless overridden for brand.
- **governance**: theme tokens owned by josh; visual changes require josh’s approval.
- **error handling**: non-blocking inline warnings for out-of-range but plausible inputs; blocking errors for invalid maths; global toasts for export failures.
- **deployment & dev**: develop locally for mvp; hosting tbd. no server-side persistence in mvp.
- **auth & access**: public app with url-based scenario sharing; no sign-in for mvp.
- **observability**: todo. exclude analytics in mvp.

---

## input guardrails (recommended)
- **number of target accounts**: 1–2,000 (soft warning above 1,000).
- **in‑market rate**: 0–70% (warning above 50%).
- **qualified opps per in‑market account**: 0.1–3.0.
- **baseline win rate**: 0–60% (warning above 50%).
- **win‑rate uplift (absolute)**: 0–20 percentage points (warning above 10pp); enforce total win rate ≤ 100% (warning above 95%).
- **acv (baseline)**: must be > £0 (soft warning above £10m).
- **acv uplift**: 0–50% (advanced toggle to allow −30% to +100% if needed).
- **opportunity‑rate uplift**: 0–100% (warning above 50%).
- **contribution margin**: 10–95% (warning outside 30–85%).
- **sales cycle (baseline)**: 1–24 months.
- **sales cycle (with abm)**: 1–baseline months (warning if ≥ baseline).
- **ramp‑up period**: 0–duration months (default 3).
- **programme duration**: 3–24 months.
- **costs**: each ≥ £0; require at least one non‑zero cost; if total cost = £0, show roi as n/a.

---

## non-functional requirements
- **performance**: recalculation < 200 ms for typical input sizes.  
- **reliability**: deterministic outputs given identical inputs.  
- **portability**: calculation engine designed so it can run in spreadsheet and web.  
- **maintainability**: modular input validation and formula utilities with unit tests (web version).

---

## data model (web version)
- **scenario**  
  - id, name, owner, created_at, updated_at  
- **inputs**  
  - duration_months, ramp_months, accounts, in_market_rate, opps_per_inmarket, win_rate, acv, margin, cycle_base_months, cycle_abm_months, uplift_win_pp, uplift_acv_pc, uplift_opp_pc, currency  
- **costs**  
  - people, media, data_tech, content, agency, other, total  
- **outputs**  
  - incremental_revenue, incremental_gp, roi, break_even_wins, payback_months plus all baseline and abm intermediates  
- **sensitivity_config**  
  - in_market_array, win_uplift_array; generated grid of roi values

---

## analytics and telemetry (web version)
- **product metrics**: scenarios created, exports, sensitivity runs.  
- **success metrics**: reduction in time to produce a business case; increase in win-rate of proposals; stakeholder satisfaction scores.

---

## acceptance criteria (mvp)
- uses shadcn/ui components with tailwind; visual styling uses specified brand tokens (bg #ffffff / #000000, cta #e95a0b, contrast #3c3c3c) and sans-serif font stack.
- public app with url-based scenario sharing; no authentication.
- keyboard navigation works across all inputs and buttons; lighthouse accessibility score ≥ 90.
- inputs enforce validation with zod; win-rate uplift cannot push total win rate above 100% (warning above 95%).
- number formatting defaults to en-gb with £; users see the same values in ui and exports.
- calculations update within 150 ms of input changes; no visible jank on typical laptops.
- url reflects current scenario; opening the copied link reproduces the same state.
- pdf and xlsx exports match on-screen numbers and labels.
- sensitivity grid renders a 5×5 table by default and computes roi correctly for each cell.
- supported browsers: last 2 major chrome/edge/firefox releases and safari ≥ 16.
- no analytics/telemetry included in mvp.
- unit tests cover the calculation engine (baseline, abm, incremental, roi, payback) with representative cases.

---

## risks and mitigations
- **overconfidence in inputs**: provide presets, ranges, and guidance notes.  
- **under-counted costs**: force entry of all cost categories and show a warning if any are zero.  
- **misinterpretation of roi**: include clear definitions and footnotes on incremental logic.  
- **scope creep to attribution**: reiterate non-goal; provide pointers to measurement frameworks separately.

---

## rollout plan
- **mvp**: simple web app developed locally; hosting tbd. public app; url-based scenario sharing; pdf/xlsx export.
- **v1**: add scenario saving (auth + db), multi-scenario compare, and collaboration.
- **enablement**: 5–7 minute loom walkthrough and a 1‑page playbook for strategists.

---

## backlog (post-mvp)
- presets by abm tier (1:1, 1:few, 1:many).  
- cohort model that distributes opportunities across months and recognises cash flows by cycle length.  
- tornado chart for key drivers.  
- multi-currency with fx notes.  
- multi-year ltv mode with churn and discount rate.  
- scenario compare (side by side) and shareable links.

---

## open questions for stakeholders
- telemetry: provider selection and event schema — **todo**.
- data retention (for v1 with saved scenarios): retention period and deletion rules — **todo**.

