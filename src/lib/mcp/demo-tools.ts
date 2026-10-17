// src/lib/mcp/demo-tools.ts
import { buildDemoData } from "@/lib/demo/fixtures";
import { withProfit, type InventoryStatusValue } from "@/lib/inventory";
import { buildSalesReport, salesWindowStart } from "@/lib/sales-report";

const DAY = 24 * 60 * 60 * 1000; // one day in milliseconds
const MAX_ROWS = 50;

export function demoInventory(
  status: InventoryStatusValue = "LISTED",
  limit = 20,
  now = new Date(),
) {
  const max = Math.max(1, Math.min(limit, MAX_ROWS));
  const data = buildDemoData(now);
  const askingPriceByTitle = new Map(
    data.listings.map((listing) => [listing.title, listing.price]),
  );

  return data.inventory
    .filter((item) => item.status === status)
    .map((item) => {
      const money = withProfit(item);
      const price =
        item.sellPrice ?? askingPriceByTitle.get(item.title) ?? null;
      const daysListed = item.listedDate
        ? Math.floor((now.getTime() - item.listedDate.getTime()) / DAY)
        : null;

      return {
        title: item.title,
        status: item.status,
        cost: item.originalCost,
        price,
        profit: money.profit,
        daysListed,
        soldDate: item.soldDate,
      };
    })
    .sort((a, b) => (b.daysListed ?? 0) - (a.daysListed ?? 0))
    .slice(0, max);
}

export function demoSalesSummary(days = 30, now = new Date()) {
  const safeDays = Math.max(1, Math.min(days, 365));

  const orders = buildDemoData(now).orders;
  const report = buildSalesReport(orders, safeDays, now);

  return { days: safeDays, ...report.summary };
}

export function demoOrders(
  days = 30,
  status?: string,
  limit = 20,
  now = new Date(),
) {
  const safeDays = Math.max(1, Math.min(days, 365));
  const max = Math.max(1, Math.min(limit, MAX_ROWS));
  const since = salesWindowStart(safeDays, now);

  const orders = buildDemoData(now).orders;

  //   Filter orders
  const filteredOrders = orders.filter((order) => {
    return order.saleDate >= since && (!status || order.status === status);
  });
  return filteredOrders
    .map((order) => ({
      item: order.itemTitle,
      salePrice: order.salePrice,
      profit: order.profit,
      status: order.status,
      saleDate: order.saleDate,
    }))
    .sort((a, b) => b.saleDate?.getTime() - a.saleDate?.getTime())
    .slice(0, max);
}
