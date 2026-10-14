// src/lib/sales-report.ts
//
// The Sales page's chart and summary, moved out of the route unchanged so the
// demo builds them with exactly the same arithmetic as real accounts do.
import { eachDayOfInterval, format, startOfDay, subDays } from "date-fns";

const NOT_COUNTED = ["CANCELLED", "REFUNDED"];

export type SalesOrder = {
  saleDate: Date;
  salePrice: number;
  profit: number;
  ebayFee: number;
  shippingCost: number;
  status?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** First instant counted by a `days`-long report ending today. */
export function salesWindowStart(days: number, now: Date) {
  return startOfDay(subDays(now, days - 1));
}

export function buildSalesReport(orders: SalesOrder[], days: number, now: Date) {
  const since = salesWindowStart(days, now);
  const counted = orders.filter(
    (o) => o.saleDate >= since && o.saleDate <= now && !(o.status && NOT_COUNTED.includes(o.status))
  );

  const daily = new Map<string, { revenue: number; profit: number; orders: number }>();
  for (const d of eachDayOfInterval({ start: since, end: now })) {
    daily.set(format(d, "yyyy-MM-dd"), { revenue: 0, profit: 0, orders: 0 });
  }
  for (const o of counted) {
    const entry = daily.get(format(o.saleDate, "yyyy-MM-dd"));
    if (entry) {
      entry.revenue += o.salePrice;
      entry.profit += o.profit;
      entry.orders += 1;
    }
  }

  const chartData = Array.from(daily.entries()).map(([date, v]) => ({
    date,
    label: format(new Date(date), "MMM d"),
    revenue: round2(v.revenue),
    profit: round2(v.profit),
    orders: v.orders,
  }));

  const totalRevenue = counted.reduce((s, o) => s + o.salePrice, 0);
  const totalProfit = counted.reduce((s, o) => s + o.profit, 0);
  const totalOrders = counted.length;

  return {
    chartData,
    summary: {
      totalRevenue: round2(totalRevenue),
      totalProfit: round2(totalProfit),
      totalFees: round2(counted.reduce((s, o) => s + o.ebayFee, 0)),
      totalShipping: round2(counted.reduce((s, o) => s + o.shippingCost, 0)),
      totalOrders,
      avgOrderValue: round2(totalOrders > 0 ? totalRevenue / totalOrders : 0),
      profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : 0,
    },
  };
}

/** `?days=` as a positive integer, falling back when missing or malformed. */
export function parseDays(value: string | null, fallback = 30) {
  const parsed = parseInt(value || String(fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
