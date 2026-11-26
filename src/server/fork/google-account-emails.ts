import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { ga4Connections, gscConnections } from "@/db/schema";

// Fork: label Google accounts by email even when their grant has expired.
//
// The account pickers ask Google for the email on every load, using the
// grant's token. Once a grant expires that call fails and the picker falls
// back to "Google account · 123456", so nobody can tell the accounts apart
// when they matter most: when one has to be reconnected. Every project
// binding (gsc_connections, ga4_connections) already stores the email of the
// account it was made with, so use that as the fallback.

type LabelledAccount = { accountId: string; email: string | null };

type RememberedEmailRow = {
  accountId: string | null;
  email: string | null;
  updatedAt: string | null;
};

/** Newest stored email per Google account id. */
export function pickRememberedEmails(
  rows: RememberedEmailRow[],
): Map<string, string> {
  const newest = new Map<string, { email: string; updatedAt: string }>();
  for (const row of rows) {
    if (!row.accountId || !row.email) continue;
    const updatedAt = row.updatedAt ?? "";
    const current = newest.get(row.accountId);
    if (!current || updatedAt > current.updatedAt) {
      newest.set(row.accountId, { email: row.email, updatedAt });
    }
  }
  return new Map([...newest].map(([id, value]) => [id, value.email]));
}

/** Fill a missing email from the stored one; live emails always win. */
export function applyRememberedEmails<T extends LabelledAccount>(
  accounts: T[],
  remembered: Map<string, string>,
): T[] {
  return accounts.map((account) =>
    account.email
      ? account
      : { ...account, email: remembered.get(account.accountId) ?? null },
  );
}

async function loadRememberedEmails(
  userId: string,
  accountIds: string[],
): Promise<Map<string, string>> {
  const [gscRows, ga4Rows] = await Promise.all([
    db
      .select({
        accountId: gscConnections.gscAccountId,
        email: gscConnections.connectedAccountEmail,
        updatedAt: gscConnections.updatedAt,
      })
      .from(gscConnections)
      .where(
        and(
          eq(gscConnections.connectedByUserId, userId),
          inArray(gscConnections.gscAccountId, accountIds),
          isNotNull(gscConnections.connectedAccountEmail),
        ),
      ),
    db
      .select({
        accountId: ga4Connections.ga4AccountId,
        email: ga4Connections.connectedAccountEmail,
        updatedAt: ga4Connections.updatedAt,
      })
      .from(ga4Connections)
      .where(
        and(
          eq(ga4Connections.connectedByUserId, userId),
          inArray(ga4Connections.ga4AccountId, accountIds),
          isNotNull(ga4Connections.connectedAccountEmail),
        ),
      ),
  ]);
  return pickRememberedEmails([...gscRows, ...ga4Rows]);
}

/** Hook for the GSC and GA4 account pickers. Never fails the listing. */
export async function withRememberedGoogleEmails<T extends LabelledAccount>(
  userId: string,
  accounts: T[],
): Promise<T[]> {
  const missing = accounts
    .filter((account) => !account.email)
    .map((account) => account.accountId);
  if (missing.length === 0) return accounts;
  try {
    return applyRememberedEmails(
      accounts,
      await loadRememberedEmails(userId, missing),
    );
  } catch (error) {
    console.error("fork.google_account_emails_failed", error);
    return accounts;
  }
}
