// Revenue/profit chart maths, shared by real users and the demo.
import { describe, expect, it } from "vitest";
import { buildSalesReport } from "@/lib/sales-report";

const NOW = new Date("2026-10-05T15:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const order = (age: number, salePrice: number, profit: number, status = "PAID") => ({
  saleDate: daysAgo(age),
  salePrice,
  profit,
  ebayFee: 1,
  shippingCost: 2,
  status,
});

describe("buildSalesReport", () => {
  it("has one bucket per day, ending today", () => {
    const report = buildSalesReport([], 30, NOW);
    expect(report.chartData).toHaveLength(30);
    expect(report.chartData.at(-1)!.date).toBe("2026-10-05");
  });

  it("counts only completed sales inside the window", () => {
    const report = buildSalesReport(
      [
        order(1, 100, 60),
        order(2, 50, 20),
        order(3, 999, 999, "CANCELLED"),
        order(4, 999, 999, "REFUNDED"),
        order(45, 999, 999), // outside a 30-day window
      ],
      30,
      NOW
    );
    expect(report.summary).toEqual({
      totalRevenue: 150,
      totalProfit: 80,
      totalFees: 2,
      totalShipping: 4,
      totalOrders: 2,
      avgOrderValue: 75,
      profitMargin: 53.33,
    });
    const yesterday = report.chartData.find((d) => d.date === "2026-10-04")!;
    expect(yesterday).toMatchObject({ revenue: 100, profit: 60, orders: 1 });
  });

  it("returns zeros, not NaN, with no sales", () => {
    const { summary } = buildSalesReport([], 7, NOW);
    expect(summary.avgOrderValue).toBe(0);
    expect(summary.profitMargin).toBe(0);
  });
});
