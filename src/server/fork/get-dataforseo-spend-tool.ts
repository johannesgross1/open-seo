import { z } from "zod";
import {
  getDataforseoSpendReport,
  monthsAgo,
} from "@/server/fork/dataforseo-spend-report";
import { type ToolContext } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import { optionalMetaOutputSchema } from "@/server/mcp/output-schemas";

// Fork-only MCP tool: monthly DataForSEO spend from the fork's spend log.

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");

const inputSchema = {
  fromMonth: monthSchema
    .optional()
    .describe("First month (YYYY-MM), inclusive. Defaults to two months ago."),
  toMonth: monthSchema
    .optional()
    .describe("Last month (YYYY-MM), inclusive. Defaults to this month."),
} as const;

type Args = z.infer<z.ZodObject<typeof inputSchema>>;

const usd = (value: number) => `$${value.toFixed(4)}`;

export const getDataforseoSpendTool = {
  name: "get_dataforseo_spend",
  config: {
    title: "Get DataForSEO spend",
    description:
      "Self-hosted only: what DataForSEO actually charged this install, per month, project, and DataForSEO account, from the install's own call log (raw provider cost, no hosted markup). Calls without a project show as 'no project'. Logging starts when the install was updated with it, so earlier months are empty. Uses no credits.",
    inputSchema,
    outputSchema: z.looseObject({
      fromMonth: z.string(),
      toMonth: z.string(),
      totalUsd: z.number(),
      rows: z.array(
        z.looseObject({
          month: z.string(),
          projectId: z.string().nullable(),
          projectName: z.string().nullable(),
          account: z.string(),
          calls: z.number(),
          costUsd: z.number(),
        }),
      ),
      endpoints: z.array(
        z.looseObject({
          path: z.string(),
          calls: z.number(),
          costUsd: z.number(),
        }),
      ),
      ...optionalMetaOutputSchema,
    }),
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: async (args: Args, context: ToolContext) => {
    const report = await getDataforseoSpendReport({
      organizationId: context.auth.organizationId,
      fromMonth: args.fromMonth ?? monthsAgo(2),
      toMonth: args.toMonth ?? monthsAgo(0),
    });
    const { fromMonth, toMonth, totalUsd, rows } = report;

    const lines = rows.length
      ? rows.map(
          (row) =>
            `- ${row.month}  ${row.projectName ?? (row.projectId ? row.projectId : "no project")}  account:${row.account}  ${row.calls} calls  ${usd(row.costUsd)}`,
        )
      : ["No DataForSEO spend logged in this range."];
    const endpointLines = report.endpoints.map(
      (row) => `- ${row.path}  ${row.calls} calls  ${usd(row.costUsd)}`,
    );

    return mcpResponse({
      text: [
        `DataForSEO spend ${fromMonth} to ${toMonth}: ${usd(totalUsd)}`,
        ...lines,
        ...(endpointLines.length ? ["", "By endpoint:", ...endpointLines] : []),
      ].join("\n"),
      structuredContent: {
        fromMonth,
        toMonth,
        totalUsd,
        rows,
        endpoints: report.endpoints,
      },
    });
  },
};
