import type { Metadata } from "next";
import Link from "next/link";

type GlossaryEntry = {
  term: string;
  metric?: string;
  description: string;
};

type GlossarySection = {
  title: string;
  entries: GlossaryEntry[];
};

const glossarySections: GlossarySection[] = [
  {
    title: "Programme setup",
    entries: [
      {
        term: "Programme duration",
        metric: "months",
        description:
          "Total months the ABM programme runs from kickoff to wrap-up. Used to derive the active influence window (duration minus ramp) and to convert incremental profit into payback months.",
      },
      {
        term: "Ramp-up period",
        metric: "months",
        description:
          "Months needed for the programme to reach steady-state performance. The value is subtracted from the duration when auto-calculating the in-market rate, so a longer ramp shortens the demand window you can influence this year.",
      },
      {
        term: "Tier preset",
        description:
          "Chooses between 1:1, 1:few, and 1:many motions. Each preset seeds defaults for target account volume, hours per account, and spend-per-account benchmarks used in coverage and budget headroom checks.",
      },
      {
        term: "Expectations preset",
        description:
          "Applies conservative, expected, or stretch defaults to uplift assumptions and (when auto mode is on) the in-market rate. Use it as a starting point before fine-tuning individual fields.",
      },
      {
        term: "Currency",
        metric: "ISO code",
        description:
          "Currency applied to every monetary input, calculation, and export. Changing it only affects formatting, not exchange rates.",
      },
      {
        term: "Number formatting locale",
        metric: "locale",
        description:
          "Locale string (for example en-GB or en-US) that controls thousand separators and decimal punctuation across the experience and any exports.",
      },
    ],
  },
  {
    title: "Market & funnel assumptions",
    entries: [
      {
        term: "Target accounts",
        metric: "accounts",
        description:
          "Total accounts in scope for the programme. Combined with the in-market rate to estimate active demand and to express coverage as a percentage of the list.",
      },
      {
        term: "In-market rate",
        metric: "%",
        description:
          "Share of the target list expected to enter an evaluation during the programme window. Auto mode converts the 95:5 rule, buying window, and duration minus ramp into this value; manual overrides lock whatever you type. Multiplying it by target accounts gives the in-market accounts used downstream.",
      },
      {
        term: "Buying window",
        metric: "months",
        description:
          "How long an account typically stays in an active evaluation when auto mode is enabled. Adjusting it reshapes the auto-derived in-market rate.",
      },
      {
        term: "Qualified opportunities per account",
        description:
          "Average number of qualified opportunities each in-market account generates. Converts in-market accounts into pipeline volume for both baseline and ABM scenarios.",
      },
      {
        term: "Baseline win rate",
        metric: "%",
        description:
          "Historic win rate without ABM influence. Applied to baseline qualified opportunities to calculate baseline wins and forms the anchor for ABM win-rate uplift.",
      },
      {
        term: "Baseline ACV",
        metric: "currency",
        description:
          "Average contract value before any ABM uplift. Combined with wins to produce baseline revenue.",
      },
      {
        term: "Contribution margin",
        metric: "%",
        description:
          "Gross margin for the products or services in scope. Applied to revenue to calculate gross profit, incremental profit, and break-even wins.",
      },
      {
        term: "Sales cycle (baseline)",
        metric: "months",
        description:
          "Typical time to close today. Sets the starting point for the ABM sales-cycle calculation and the velocity factor used in payback.",
      },
      {
        term: "Sales cycle (ABM)",
        metric: "months",
        description:
          "Projected cycle length with ABM support. Auto mode applies tier reduction bands, alignment multipliers, and coverage intensity; enabling manual override lets you enter a specific number. The value feeds the payback calculation and velocity cues.",
      },
    ],
  },
  {
    title: "Impact & velocity uplifts",
    entries: [
      {
        term: "Win-rate uplift",
        metric: "percentage points",
        description:
          "Increase in win rate attributable to ABM activities before alignment and intensity scaling. Added to the baseline win rate when calculating ABM expected wins.",
      },
      {
        term: "ACV uplift",
        metric: "%",
        description:
          "Percentage increase in deal size due to ABM. After scaling by coverage intensity, it multiplies the baseline ACV to produce ABM revenue.",
      },
      {
        term: "Opportunity uplift",
        metric: "%",
        description:
          "Percentage lift in qualified opportunity volume delivered by ABM. Adjusted by alignment and intensity before applying to baseline opportunity volume.",
      },
    ],
  },
  {
    title: "Investment & capacity",
    entries: [
      {
        term: "Total programme investment",
        metric: "currency",
        description:
          "Single-field entry for the annual ABM budget. When populated it becomes the programme cost even if individual categories are zero; clearing it hands control back to the detailed cost breakdown.",
      },
      {
        term: "People",
        metric: "currency",
        description:
          "Internal headcount cost allocated to the programme. Rolls into total programme cost and ROI calculations.",
      },
      {
        term: "Media",
        metric: "currency",
        description:
          "Paid media budget dedicated to ABM tactics such as advertising, syndication, or sponsorships.",
      },
      {
        term: "Data & tech",
        metric: "currency",
        description:
          "Spend on data providers, intent platforms, enrichment, and tooling that underpin ABM execution.",
      },
      {
        term: "Content",
        metric: "currency",
        description:
          "Production and personalisation costs for assets, experiences, and creative tailored to target accounts.",
      },
      {
        term: "Agency & partners",
        metric: "currency",
        description:
          "Fees paid to external agencies or partners supporting the programme.",
      },
      {
        term: "Other",
        metric: "currency",
        description:
          "Any additional investments not captured above. Included in the total programme cost.",
      },
      {
        term: "Cap coverage by",
        description:
          "Dropdown that sets the primary constraint on how many accounts can be fully treated. Budget mode converts spend into account capacity using tier spend-per-account benchmarks; Team time mode uses available marketing and sales hours.",
      },
      {
        term: "Marketers (FTE)",
        metric: "FTE",
        description:
          "Full-time-equivalent marketers dedicated to the programme when capping by team time. Fractions are allowed to represent partial allocations.",
      },
      {
        term: "Sellers (FTE)",
        metric: "FTE",
        description:
          "Full-time-equivalent sellers covering the programme when team time is the constraint.",
      },
      {
        term: "Marketing time available",
        metric: "%",
        description:
          "Proportion of each marketer’s time available for this plan. Combined with marketing FTE to calculate total marketing hours.",
      },
      {
        term: "Sales time available",
        metric: "%",
        description:
          "Share of each seller’s time allocated to the programme. Works with sales FTE to determine sales coverage capacity.",
      },
      {
        term: "Hours per treated account",
        metric: "hours/account/month",
        description:
          "Effort required to fully run the ABM motion for one account each month. Defaults follow the selected tier and convert available hours into the number of accounts you can treat.",
      },
    ],
  },
  {
    title: "Alignment & operating model",
    entries: [
      {
        term: "Sales & marketing alignment",
        description:
          "Qualitative assessment of go-to-market coordination (Poor, Standard, Excellent). Sets multipliers that scale opportunity uplift, win-rate uplift, and sales-velocity reductions before the model runs.",
      },
      {
        term: "Intensity multiplier",
        description:
          "Derived factor based on coverage saturation. Concentrated coverage (treating a smaller slice of the list) increases the multiplier applied to uplifts and sales cycle reductions.",
      },
      {
        term: "Dilution risk",
        description:
          "Guardrail shown when treated accounts and uplift assumptions suggest a spread-too-thin programme. Use it as a cue to tighten scope or revisit assumptions.",
      },
    ],
  },
  {
    title: "Sensitivity settings",
    entries: [
      {
        term: "In-market range",
        metric: "list of %",
        description:
          "Comma-separated list of in-market rates used to build the ROI sensitivity grid in the programme detail drawer.",
      },
      {
        term: "Win uplift range",
        metric: "list of percentage points",
        description:
          "Comma-separated list of win-rate uplifts (in percentage points) plotted along the columns of the sensitivity grid.",
      },
      {
        term: "Resolution",
        metric: "integer",
        description:
          "Optional odd number (3–11) that controls how many steps the sensitivity grid uses when interpolating additional points.",
      },
    ],
  },
  {
    title: "Scoreboard & outputs",
    entries: [
      {
        term: "Programme revenue",
        metric: "currency",
        description:
          "ABM expected wins multiplied by the uplifted ACV.",
      },
      {
        term: "Programme gross profit",
        metric: "currency",
        description:
          "Programme revenue multiplied by the contribution margin.",
      },
      {
        term: "Programme cost",
        metric: "currency",
        description:
          "Total programme investment after applying the detailed cost breakdown or single-field budget.",
      },
      {
        term: "Programme profit after spend",
        metric: "currency",
        description:
          "Programme gross profit minus programme cost. Displayed as 'Profit after spend (this period)' in the headline KPIs.",
      },
      {
        term: "Net ROI (incremental)",
        description:
          "(Incremental gross profit - programme cost) ÷ programme cost. Null when costs are zero.",
      },
      {
        term: "Gross ROMI",
        description:
          "Incremental gross profit ÷ programme cost. Ignores the subtraction of cost and is useful for marketing mix comparisons.",
      },
      {
        term: "Payback",
        metric: "months",
        description:
          "Months required for incremental gross profit to repay programme cost, factoring in the ABM versus baseline sales-cycle velocity.",
      },
      {
        term: "Expected additional wins",
        metric: "wins",
        description:
          "ABM expected wins minus baseline expected wins. Highlighted as 'ABM - baseline' in the scoreboard badges.",
      },
      {
        term: "Break-even wins",
        metric: "wins",
        description:
          "Number of ABM wins required for gross profit to cover programme cost. Derived from ACV, margin, and total spend.",
      },
      {
        term: "Treated accounts",
        metric: "accounts",
        description:
          "Number of accounts the model says you can fully cover based on the chosen constraint (budget or team time).",
      },
      {
        term: "Coverage %",
        metric: "%",
        description:
          "Treated accounts divided by total target accounts. Helps you gauge how concentrated the programme is.",
      },
      {
        term: "Budget headroom / shortfall",
        metric: "accounts",
        description:
          "Difference between capacity (budget-derived or team hours) and expected in-market accounts. Positive values indicate spare capacity; negative values signal a gap to close.",
      },
    ],
  },
];

export const metadata: Metadata = {
  title: "Glossary | ABM ROI Calculator",
  description:
    "Definitions for the ABM ROI Calculator inputs, assumptions, and outputs.",
};

export default function GlossaryPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-12 lg:px-10 lg:py-16">
        <header className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              ABM ROI Studio
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
              Glossary of terms
            </h1>
            <p className="text-base text-muted-foreground">
              Use this reference to align stakeholders on the inputs that feed the calculation model and the metrics the scoreboard surfaces. Every term below maps directly to a control or output inside the experience.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-cta transition hover:text-cta/80"
          >
            <span aria-hidden>←</span>
            Back to the calculator
          </Link>
        </header>

        <section className="rounded-xl border border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
          <h2 className="mb-3 text-base font-semibold uppercase tracking-wide text-foreground">
            Methodology
          </h2>
          <ol className="space-y-3 list-decimal pl-5">
            <li>
              We size the active demand pool by multiplying target accounts by the in-market rate, which is auto-derived from duration, ramp, buying window, and the 95:5 assumption when auto mode is enabled. Coverage and capacity settings cap treated accounts, and the resulting coverage rate replaces the raw in-market rate before any downstream maths.
            </li>
            <li>
              Baseline pipeline is built by chaining the funnel: in-market accounts × qualified opportunities per account → baseline qualified opps; those opps × baseline win rate → expected wins; wins × baseline ACV → baseline revenue; revenue × contribution margin → baseline gross profit.
            </li>
            <li>
              We apply the declared opportunity, win-rate, and ACV uplifts after scaling them by sales/marketing alignment multipliers and the intensity factor (coverage saturation^0.8). These adjusted uplifts generate the ABM scenario, producing uplifted opps, wins, ACV, revenue, and gross profit on the same funnel maths as the baseline.
            </li>
            <li>
              Incremental outputs compare ABM to baseline: incremental revenue and gross profit are simple differences; programme cost is the sum of people, media, data & tech, content, agency, and other spend (or the single-field override when provided). ROI = (incremental gross profit − cost) ÷ cost, while Gross ROMI = incremental gross profit ÷ cost.
            </li>
            <li>
              Payback divides programme cost by incremental gross profit per month, adjusted by the velocity factor (baseline sales cycle ÷ ABM sales cycle). Break-even wins = ceil(cost ÷ (ABM ACV × contribution margin)). We also surface incremental wins and profit after spend (ABM gross profit − cost) for the scoreboard.
            </li>
          </ol>
        </section>

        <div className="space-y-10">
          {glossarySections.map((section) => (
            <section key={section.title} className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground lg:text-2xl">
                {section.title}
              </h2>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-6">
                <dl className="space-y-4">
                  {section.entries.map((entry) => (
                    <div
                      key={entry.term}
                      className="space-y-1 border-b border-border/40 pb-4 last:border-b-0 last:pb-0"
                    >
                      <dt className="flex items-center gap-3 text-sm font-semibold text-foreground">
                        <span>{entry.term}</span>
                        {entry.metric ? (
                          <span className="rounded bg-background px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                            {entry.metric}
                          </span>
                        ) : null}
                      </dt>
                      <dd className="text-sm leading-relaxed text-muted-foreground">
                        {entry.description}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
