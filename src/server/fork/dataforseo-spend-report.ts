import { ProjectService } from "@/server/features/projects/services/ProjectService";
import { getDataforseoSpend } from "@/server/fork/dataforseo-spend-log";

// Fork-only: the spend log as one report, shared by the MCP tool and the
// settings page.

function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** YYYY-MM of the month `count` months before this one (UTC). */
export function monthsAgo(count: number): string {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - count);
  return monthOf(date);
}

export async function getDataforseoSpendReport(input: {
  organizationId: string;
  fromMonth: string;
  toMonth: string;
}) {
  const projects = await ProjectService.listProjects(input.organizationId);
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const spend = await getDataforseoSpend({
    fromMonth: input.fromMonth,
    toMonth: input.toMonth,
    projectIds: projects.map((p) => p.id),
  });
  const rows = spend.rows.map((row) => ({
    ...row,
    projectName: row.projectId ? (names.get(row.projectId) ?? null) : null,
  }));
  const monthTotals = new Map<string, number>();
  for (const row of rows) {
    monthTotals.set(row.month, (monthTotals.get(row.month) ?? 0) + row.costUsd);
  }
  return {
    fromMonth: input.fromMonth,
    toMonth: input.toMonth,
    totalUsd: rows.reduce((sum, row) => sum + row.costUsd, 0),
    months: [...monthTotals].map(([month, costUsd]) => ({ month, costUsd })),
    rows,
    endpoints: spend.endpoints,
  };
}
