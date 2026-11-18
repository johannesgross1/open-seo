import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "cn";
import { SectionHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { getForkDataforseoSpend } from "@/serverFunctions/fork-dataforseo-spend";

// Fork-only: monthly DataForSEO spend of this self-hosted install, from the
// fork's spend log.

export const DATAFORSEO_COSTS_ANCHOR = "dataforseo-costs";
const MONTHS_SHOWN = 6;

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const usd = (value: number) => usdFormat.format(value);

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The last `count` months, newest first, as YYYY-MM. */
function recentMonths(count: number): string[] {
  const months: string[] = [];
  const date = new Date();
  date.setUTCDate(1);
  for (let i = 0; i < count; i++) {
    months.push(date.toISOString().slice(0, 7));
    date.setUTCMonth(date.getUTCMonth() - 1);
  }
  return months;
}

const ENDPOINT_LABELS: [prefix: string, label: string][] = [
  ["/v3/serp/google/organic", "Rank tracking & SERPs"],
  ["/v3/serp/google/maps", "Local rankings"],
  ["/v3/serp/google/local_finder", "Local rankings"],
  ["/v3/serp", "SERPs"],
  ["/v3/dataforseo_labs", "Keyword & domain research"],
  ["/v3/keywords_data", "Keyword data"],
  ["/v3/backlinks", "Backlinks"],
  ["/v3/on_page/lighthouse", "Lighthouse"],
  ["/v3/on_page", "Site audit"],
  ["/v3/ai_optimization", "AI visibility"],
  ["/v3/business_data", "Business profiles"],
];

function endpointLabel(path: string): string {
  return (
    ENDPOINT_LABELS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? "Other"
  );
}

export function DataforseoSpendSettings() {
  const months = recentMonths(MONTHS_SHOWN);
  const [selectedMonth, setSelectedMonth] = useState(months[0]);
  const spendQuery = useQuery({
    queryKey: ["fork", "dataforseoSpend", MONTHS_SHOWN],
    queryFn: () => getForkDataforseoSpend({ data: { months: MONTHS_SHOWN } }),
  });

  return (
    <section id={DATAFORSEO_COSTS_ANCHOR} className="scroll-mt-6 space-y-3">
      <SectionHeader
        title="DataForSEO costs"
        hint="What DataForSEO charged this install, from its own call log: raw provider prices, no markup. Months before the log was added show nothing."
      />
      <QueryState
        query={spendQuery}
        errorFallback="We couldn't load the DataForSEO costs."
      >
        {(report) => {
          const totals = new Map(
            report.months.map((row) => [row.month, row.costUsd]),
          );
          const monthRows = report.rows.filter(
            (row) => row.month === selectedMonth,
          );
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {months.map((month) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => setSelectedMonth(month)}
                    aria-pressed={month === selectedMonth}
                    className={cn(
                      "rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-foreground/5",
                      month === selectedMonth &&
                        "border-primary ring-1 ring-primary",
                    )}
                  >
                    <div className="text-xs text-muted-foreground">
                      {monthLabel(month)}
                    </div>
                    <div className="font-mono text-sm tabular-nums">
                      {usd(totals.get(month) ?? 0)}
                    </div>
                  </button>
                ))}
              </div>

              {monthRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No DataForSEO calls logged in {monthLabel(selectedMonth)}.
                </p>
              ) : (
                <TableCard>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthRows.map((row) => (
                        <TableRow key={`${row.projectId}:${row.account}`}>
                          <TableCell>
                            {row.projectName ??
                              (row.projectId ? (
                                <span className="font-mono text-xs">
                                  {row.projectId}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  No project
                                </span>
                              ))}
                          </TableCell>
                          <TableCell>{row.account}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.calls}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {usd(row.costUsd)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableCard>
              )}

              {report.endpoints.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    By call type, last {MONTHS_SHOWN} months
                  </h3>
                  <TableCard>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Endpoint</TableHead>
                          <TableHead className="text-right">Calls</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.endpoints.map((row) => (
                          <TableRow key={row.path}>
                            <TableCell>{endpointLabel(row.path)}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {row.path}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.calls}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {usd(row.costUsd)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableCard>
                </div>
              ) : null}
            </div>
          );
        }}
      </QueryState>
    </section>
  );
}
