import { AsyncLocalStorage } from "node:async_hooks";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

// Fork-only: send a project's DataForSEO calls to its own DataForSEO account.
// Configuration lives in env vars only, never in the repository:
//
//   FORK_DATAFORSEO_ACCOUNTS          {"<label>": "<base64 login:password>"}
//   FORK_DATAFORSEO_PROJECT_ACCOUNTS  {"<projectId>": "<label>"}
//
// A project without an entry uses DATAFORSEO_API_KEY (reported as "default").
// A project mapped to a label without a key fails instead of falling back, so
// a misconfiguration never bills the wrong account.

const DEFAULT_DATAFORSEO_ACCOUNT = "default";

const projectScope = new AsyncLocalStorage<{ projectId: string | null }>();

/** Runs `fn` with its DataForSEO calls attributed to `projectId`. */
export function runWithDataforseoProject<T>(
  projectId: string | null | undefined,
  fn: () => T,
): T {
  return projectScope.run({ projectId: projectId ?? null }, fn);
}

export function currentDataforseoProjectId(): string | null {
  return projectScope.getStore()?.projectId ?? null;
}

function parseStringRecord(raw: string, name: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(
      "DATAFORSEO_AUTH_FAILED",
      `${name} is not valid JSON; DataForSEO calls are stopped until it is fixed`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AppError(
      "DATAFORSEO_AUTH_FAILED",
      `${name} must be a JSON object of strings`,
    );
  }
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string" && value !== "") record[key] = value;
  }
  return record;
}

type ForkDataforseoAccount = { label: string; apiKey: string };

/**
 * The account the current project's calls go to, or null when the project
 * has no entry (the caller then uses the deployment's default key).
 */
export async function resolveForkDataforseoAccount(): Promise<ForkDataforseoAccount | null> {
  const projectId = currentDataforseoProjectId();
  if (!projectId) return null;
  const mapping = await getOptionalEnvValue("FORK_DATAFORSEO_PROJECT_ACCOUNTS");
  if (!mapping) return null;
  const label = parseStringRecord(mapping, "FORK_DATAFORSEO_PROJECT_ACCOUNTS")[
    projectId
  ];
  if (!label) return null;
  const accounts = parseStringRecord(
    (await getOptionalEnvValue("FORK_DATAFORSEO_ACCOUNTS")) ?? "{}",
    "FORK_DATAFORSEO_ACCOUNTS",
  );
  const apiKey = accounts[label];
  if (!apiKey) {
    throw new AppError(
      "DATAFORSEO_AUTH_FAILED",
      `No DataForSEO key is configured for account "${label}" (FORK_DATAFORSEO_ACCOUNTS)`,
    );
  }
  return { label, apiKey };
}

/** The label of the account the current call goes to, for the spend log. */
export async function currentDataforseoAccountLabel(): Promise<string> {
  try {
    return (
      (await resolveForkDataforseoAccount())?.label ??
      DEFAULT_DATAFORSEO_ACCOUNT
    );
  } catch {
    return "misconfigured";
  }
}

/** The `projectId` argument of a project-scoped MCP tool call, if any. */
export function projectIdFromToolArgs(args: unknown): string | null {
  if (typeof args !== "object" || args === null) return null;
  const projectId: unknown = Reflect.get(args, "projectId");
  return typeof projectId === "string" && projectId !== "" ? projectId : null;
}
