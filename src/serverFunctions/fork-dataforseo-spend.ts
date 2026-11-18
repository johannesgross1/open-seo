import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getDataforseoSpendReport,
  monthsAgo,
} from "@/server/fork/dataforseo-spend-report";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

// Fork-only: the DataForSEO spend log for the settings page.
export const getForkDataforseoSpend = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .validator(z.object({ months: z.number().int().min(1).max(24) }))
  .handler(({ context, data }) =>
    getDataforseoSpendReport({
      organizationId: context.organizationId,
      fromMonth: monthsAgo(data.months - 1),
      toMonth: monthsAgo(0),
    }),
  );
