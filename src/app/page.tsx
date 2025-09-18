import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MOCK_RESULTS = [
  { label: "Incremental Revenue", value: "£1.2m" },
  { label: "Incremental Gross Profit", value: "£720k" },
  { label: "ROI", value: "186%" },
  { label: "Break-even Wins", value: "6" },
  { label: "Payback", value: "7.5 months" },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 lg:gap-8 lg:px-10">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
              Planning-stage ABM ROI Calculator
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Capture programme assumptions, model baseline versus ABM scenarios, and export a
              client-ready business case. Inputs are grouped so we can progressively wire the
              calculation engine and guardrails.
            </p>
          </div>
          <Button size="lg" className="self-start bg-cta text-white hover:bg-cta/90" disabled>
            Export (coming soon)
          </Button>
        </header>

        <main className="grid gap-6 lg:grid-cols-[2fr_1fr] xl:gap-8">
          <section className="flex flex-col gap-6 lg:gap-8">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Programme Settings</CardTitle>
                <CardDescription>
                  Duration, ramp, and formatting controls that gate downstream calculations.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="duration">Programme duration (months)</Label>
                  <Input id="duration" defaultValue={12} inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ramp">Ramp-up period (months)</Label>
                  <Input id="ramp" defaultValue={3} inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select defaultValue="gbp">
                    <SelectTrigger id="currency">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gbp">GBP (£)</SelectItem>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formatting">Number formatting</Label>
                  <Select defaultValue="en-gb">
                    <SelectTrigger id="formatting">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-gb">English (UK)</SelectItem>
                      <SelectItem value="en-us">English (US)</SelectItem>
                      <SelectItem value="en-eu">English (EU)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Market & Funnel Inputs</CardTitle>
                <CardDescription>
                  Manual entries for addressable accounts, funnels, and baseline conversion metrics.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <Field id="accounts" label="Target accounts" defaultValue="150" />
                <Field id="in-market" label="In-market rate (%)" defaultValue="35" />
                <Field
                  id="opps"
                  label="Qualified opps per in-market account"
                  defaultValue="0.6"
                />
                <Field id="win-rate" label="Baseline win rate (%)" defaultValue="22" />
                <Field id="acv" label="Baseline ACV" defaultValue="65000" prefix="£" />
                <Field id="margin" label="Contribution margin (%)" defaultValue="55" />
                <Field id="cycle-base" label="Sales cycle (baseline months)" defaultValue="9" />
                <Field id="cycle-abm" label="Sales cycle (ABM months)" defaultValue="6" />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>ABM Uplifts & Programme Costs</CardTitle>
                <CardDescription>
                  Uplifts apply to baseline metrics; cost entries power ROI, break-even and payback.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <Field id="uplift-win" label="Win-rate uplift (pp)" defaultValue="12" />
                <Field id="uplift-acv" label="ACV uplift (%)" defaultValue="18" />
                <Field id="uplift-opp" label="Opportunity-rate uplift (%)" defaultValue="25" />
                <Field id="people-cost" label="People cost" defaultValue="220000" prefix="£" />
                <Field id="media-cost" label="Media" defaultValue="90000" prefix="£" />
                <Field id="data-cost" label="Data & tech" defaultValue="45000" prefix="£" />
                <Field id="content-cost" label="Content" defaultValue="60000" prefix="£" />
                <Field id="agency-cost" label="Agency & partners" defaultValue="40000" prefix="£" />
                <Field id="other-cost" label="Other" defaultValue="15000" prefix="£" />
              </CardContent>
            </Card>
          </section>

          <aside className="flex flex-col gap-6 lg:gap-8">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Financial Snapshot</CardTitle>
                <CardDescription>
                  Hook up to calculation engine for live outputs and guardrails.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {MOCK_RESULTS.map((metric) => (
                    <li key={metric.label} className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">{metric.label}</span>
                      <span className="text-base font-medium text-foreground">
                        {metric.value}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Placeholder values for layout only. Replace with deterministic calculations and
                  validation messaging.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Sensitivity Grid</CardTitle>
                <CardDescription>
                  Default 5×5 matrix to explore in-market and win-rate uplift combinations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                  Sensitivity visualisation placeholder. Implement ROI grid calculations and
                  heat-map once engine & formatting utilities are in place.
                </div>
              </CardContent>
            </Card>
          </aside>
        </main>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  defaultValue,
  prefix,
}: {
  id: string;
  label: string;
  defaultValue?: string | number;
  prefix?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          defaultValue={defaultValue}
          inputMode="decimal"
          className={prefix ? "pl-7" : undefined}
        />
      </div>
    </div>
  );
}
