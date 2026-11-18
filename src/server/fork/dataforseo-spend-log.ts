import {
  currentDataforseoAccountLabel,
  currentDataforseoProjectId,
} from "@/server/fork/dataforseo-accounts";

// Fork-only: a log of what every DataForSEO call cost, by project and
// account, so a self-hosted install can see its monthly spend. The upstream
// billing code meters hosted installs only.
//
// The table is created on first use instead of through a Drizzle migration,
// so the fork adds no migration that could collide with upstream's numbering.
// D1 (the standalone default) only; Postgres installs log nothing.

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS fork_dataforseo_spend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  project_id TEXT,
  account TEXT NOT NULL,
  path TEXT NOT NULL,
  cost_usd REAL NOT NULL
)`;
const CREATE_INDEX =
  "CREATE INDEX IF NOT EXISTS fork_dataforseo_spend_created_idx ON fork_dataforseo_spend (created_at)";

let ensuredFor: D1Database | undefined;

async function spendDatabase(): Promise<D1Database | null> {
  // Unit tests run without the Workers runtime; the log is runtime-only.
  if (typeof process !== "undefined" && process.env?.VITEST) return null;
  // Imported lazily so modules that record spend stay importable in tests.
  const [{ env }, { getDatabaseProvider }] = await Promise.all([
    import("cloudflare:workers"),
    import("@/db/provider"),
  ]);
  if (getDatabaseProvider() !== "d1") return null;
  const binding = env.DB;
  if (!binding) return null;
  if (ensuredFor !== binding) {
    await binding.prepare(CREATE_TABLE).run();
    await binding.prepare(CREATE_INDEX).run();
    ensuredFor = binding;
  }
  return binding;
}

function endpointPath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? path;
  return withoutQuery.replace(/^https?:\/\/[^/]+/, "");
}

/** Records one DataForSEO call's cost. Never throws: logging must not fail a call. */
export async function recordDataforseoSpend(
  path: string,
  costUsd: unknown,
): Promise<void> {
  if (typeof costUsd !== "number" || !(costUsd > 0)) return;
  try {
    const database = await spendDatabase();
    if (!database) return;
    await database
      .prepare(
        "INSERT INTO fork_dataforseo_spend (created_at, project_id, account, path, cost_usd) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        new Date().toISOString(),
        currentDataforseoProjectId(),
        await currentDataforseoAccountLabel(),
        endpointPath(path),
        costUsd,
      )
      .run();
  } catch (error) {
    console.warn("[fork] DataForSEO spend log failed", error);
  }
}

type DataforseoSpendRow = {
  month: string;
  projectId: string | null;
  account: string;
  calls: number;
  costUsd: number;
};

type DataforseoSpendEndpointRow = {
  path: string;
  calls: number;
  costUsd: number;
};

/**
 * Spend per month, project, and account for `[fromMonth, toMonth]`
 * (YYYY-MM, inclusive). `projectIds` limits it to those projects plus calls
 * without a project.
 */
export async function getDataforseoSpend(input: {
  fromMonth: string;
  toMonth: string;
  projectIds: string[];
}): Promise<{
  rows: DataforseoSpendRow[];
  endpoints: DataforseoSpendEndpointRow[];
}> {
  const database = await spendDatabase();
  if (!database) return { rows: [], endpoints: [] };
  const placeholders = input.projectIds.map(() => "?").join(", ");
  const projectFilter = input.projectIds.length
    ? `(project_id IS NULL OR project_id IN (${placeholders}))`
    : "project_id IS NULL";
  const where = `substr(created_at, 1, 7) BETWEEN ? AND ? AND ${projectFilter}`;
  const params = [input.fromMonth, input.toMonth, ...input.projectIds];

  const grouped = await database
    .prepare(
      `SELECT substr(created_at, 1, 7) AS month, project_id, account, COUNT(*) AS calls, SUM(cost_usd) AS cost
       FROM fork_dataforseo_spend WHERE ${where}
       GROUP BY month, project_id, account ORDER BY month DESC, cost DESC`,
    )
    .bind(...params)
    .all<{
      month: string;
      project_id: string | null;
      account: string;
      calls: number;
      cost: number;
    }>();
  const byEndpoint = await database
    .prepare(
      `SELECT path, COUNT(*) AS calls, SUM(cost_usd) AS cost
       FROM fork_dataforseo_spend WHERE ${where}
       GROUP BY path ORDER BY cost DESC LIMIT 25`,
    )
    .bind(...params)
    .all<{ path: string; calls: number; cost: number }>();

  return {
    rows: grouped.results.map((row) => ({
      month: row.month,
      projectId: row.project_id,
      account: row.account,
      calls: row.calls,
      costUsd: row.cost,
    })),
    endpoints: byEndpoint.results.map((row) => ({
      path: row.path,
      calls: row.calls,
      costUsd: row.cost,
    })),
  };
}
