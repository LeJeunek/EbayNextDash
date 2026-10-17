import { describe, it, expect } from "vitest";
import {
  demoInventory,
  demoSalesSummary,
  demoOrders,
} from "@/lib/mcp/demo-tools";

// A fixed "today", so the expected numbers never change.
const NOW = new Date("2026-10-01T12:00:00Z");

describe("demoInventory", () => {
  it("lists the 3 listed items, oldest first", () => {
    const rows = demoInventory("LISTED", 20, NOW);

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.daysListed)).toEqual([85, 50, 25]);
    expect(rows.map((r) => r.price)).toEqual([89, 45, 149.99]);
  });
  it("lists all 8 sold items", () => {
    expect(demoInventory("SOLD", 20, NOW)).toHaveLength(8);
  });
  it("keeps the row limit between 1 and 50", () => {
    expect(demoInventory("SOLD", 2, NOW)).toHaveLength(2);
  });
});

describe("demoSalesSummary", () => {
  it("totals $486.99 for 30 days", () => {
    const summary = demoSalesSummary(30, NOW);
    expect(summary.totalRevenue).toBe(486.99);
    expect(summary.totalProfit).toBe(343.42);
  });

  it("caps days at 365", () => {
    const summary = demoSalesSummary(400, NOW);
    expect(summary.days).toBe(365);
  });
});

describe("demoOrders", () => {
  it("gives 9 orders for 30 days", () => {
    const rows = demoOrders(30, undefined, 20, NOW);
    expect(rows).toHaveLength(9);
  });
  it("never includes buyer details", () => {
    const rows = demoOrders(30, undefined, 20, NOW);
    const fields = Object.keys(rows[0]);
    expect(fields).not.toContain("buyerUsername");
    expect(fields).not.toContain("buyerEmail");
  });
  it("filter by status", () => {
    expect(demoOrders(30, "CANCELLED", 20, NOW)).toHaveLength(1);
  });

  it("gives 3 orders for the last 7 days", () => {
    expect(demoOrders(7, undefined, 20, NOW)).toHaveLength(3);
  });

  it("caps days at 365", () => {
    expect(demoOrders(5000, undefined, 50, NOW)).toHaveLength(13);
  });

  it("never includes buyer details", () => {
    const fields = Object.keys(demoOrders(30, undefined, 20, NOW)[0]);
    expect(fields).not.toContain("buyerUsername");
    expect(fields).not.toContain("buyerEmail");
  });
});
