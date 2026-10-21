// src/lib/mcp/server.ts
//
// The public demo MCP server. Every tool reads the in-code demo data
// (via ./demo-tools); nothing here touches the database, eBay, or a
// signed-in user. The route at /api/mcp builds a fresh server per request.
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { INVENTORY_STATUSES } from "@/lib/inventory";
import { demoInventory, demoOrders, demoSalesSummary } from "./demo-tools";

// Order statuses are a different list from inventory statuses,
// so list_orders needs its own copy. Typed out here (not imported from
// @prisma/client) so this file never depends on the database package.
const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

// Wraps any data in the MCP tool-result shape, as pretty-printed JSON.
// `as const` pins type to exactly "text"; without it TypeScript widens it
// to a plain string and the build fails.
const toTextResult = (data: unknown) => {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
};

export function buildDemoMcpServer() {
  const server = new McpServer({ name: "resold-demo", version: "1.0.0" });

  // ── Tool 1: inventory ──────────────────────────────────────────
  // Listed or sold items, oldest listing first. Listed items show their
  // asking price; profit stays null until an item sells.
  server.registerTool(
    "list_inventory",
    {
      title: "List demo inventory",
      description:
        "Lists the demo seller's inventory, oldest listing first, with cost, price, profit and days listed. This is sample data.",
      inputSchema: z.object({
        status: z
          .enum(INVENTORY_STATUSES)
          .default("LISTED")
          .describe("Which inventory status to return"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Maximum rows to return"),
      }),
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      const { status, limit } = input;
      const inventory = demoInventory(status, limit);
      return toTextResult(inventory);
    },
  );

  // ── Tool 2: sales summary ──────────────────────────────────────
  // Same totals the Sales page shows (reuses buildSalesReport).
  // Cancelled and refunded orders are not counted.
  server.registerTool(
    "sales_summary",
    {
      title: "Sales summary",
      description:
        "Summarizes the demo seller's sales for the last N days, with total revenue and profit. This is sample data.",
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .default(30)
          .describe("Number of days to summarize"),
      }),
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      const { days } = input;
      const summary = demoSalesSummary(days);
      return toTextResult(summary);
    },
  );

  // ── Tool 3: orders ─────────────────────────────────────────────
  // Every order in the window, cancelled ones included, newest first.
  // Buyer names and order ids are deliberately left out.
  server.registerTool(
    "list_orders",
    {
      title: "List demo orders",
      description:
        "Lists the demo seller's recent orders, newest first, optionally filtered by status. This is sample data.",
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .default(30)
          .describe("Number of days to look back"),
        status: z
          .enum(ORDER_STATUSES)
          .optional()
          .describe("Filter by order status"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Maximum rows to return"),
      }),
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      const { days, status, limit } = input;
      const orders = demoOrders(days, status, limit);
      return toTextResult(orders);
    },
  );

  // ── Prompt: stale inventory report ─────────────────────────────
  // The user triggers this one. The stale items are filtered here in code
  // (exact, and keeps the message short); Claude only writes suggestions.
  // Prompt arguments always arrive as text, hence z.string() + Number().
  server.registerPrompt(
    "stale_inventory_report",
    {
      title: "Stale inventory report",
      description:
        "Lists demo inventory that has been listed for more than N days, and asks for a price drop or relist suggestion for each. This is sample data.",
      argsSchema: z.object({
        maxDays: z
          .string()
          .regex(/^\d+$/, "Must be a whole number of days")
          .describe("Days listed before an item counts as stale, e.g. 60"),
      }),
    },
    ({ maxDays }) => {
      const threshold = Number(maxDays); // "60" → 60
      const staleItems = demoInventory("LISTED", 50).filter(
        (row) => row.daysListed !== null && row.daysListed > threshold,
      );

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `These items have been listed more than ${maxDays} days: ${JSON.stringify(staleItems, null, 2)}\n\nPlease suggest a price drop or relist strategy for each.`,
            },
          },
        ],
      };
    },
  );

  return server;
}
