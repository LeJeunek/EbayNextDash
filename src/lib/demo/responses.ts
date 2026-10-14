// src/lib/demo/responses.ts
//
// What each API route returns to a demo visitor: the fixtures, shaped exactly
// like the route's real response and filtered/sorted by the same rules the
// real Prisma queries use. Nothing here touches the database or the network.
import { NextResponse } from "next/server";
import type { InventoryItem } from "@prisma/client";
import { buildDemoData } from "./fixtures";
import { DEMO_READ_ONLY_MESSAGE, DEMO_SYNC_NOTICE } from "./config";
import { filterInventory, summarize, toCsv, withProfit } from "@/lib/inventory";
import { buildSalesReport } from "@/lib/sales-report";

const DAY = 24 * 60 * 60 * 1000;

/** 403 for any change a demo visitor attempts. */
export function demoReadOnly() {
  return NextResponse.json({ error: DEMO_READ_ONLY_MESSAGE, demo: true }, { status: 403 });
}

/** Postgres ORDER BY soldDate DESC (NULLS FIRST), createdAt DESC — the inventory list. */
export function sortForInventoryList<T extends Pick<InventoryItem, "soldDate" | "createdAt">>(items: T[]) {
  return [...items].sort((a, b) => {
    if (!a.soldDate !== !b.soldDate) return a.soldDate ? 1 : -1;
    const bySold = (b.soldDate?.getTime() ?? 0) - (a.soldDate?.getTime() ?? 0);
    return bySold || b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** Postgres ORDER BY soldDate ASC (NULLS LAST), createdAt ASC — the print summary. */
export function sortForPrint<T extends Pick<InventoryItem, "soldDate" | "createdAt">>(items: T[]) {
  return [...items].sort((a, b) => {
    if (!a.soldDate !== !b.soldDate) return a.soldDate ? -1 : 1;
    const bySold = (a.soldDate?.getTime() ?? 0) - (b.soldDate?.getTime() ?? 0);
    return bySold || a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function demoListings(params: URLSearchParams, now = new Date()) {
  const status = params.get("status");
  const listings = buildDemoData(now)
    .listings.filter((l) => !status || l.status === status)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((l) => ({ ...l, _count: { orders: 0 } }));

  return {
    listings,
    demo: true as const,
    ...(params.get("sync") === "true" ? { notice: DEMO_SYNC_NOTICE } : {}),
  };
}

export function demoListing(id: string, now = new Date()) {
  const listing = buildDemoData(now).listings.find((l) => l.id === id);
  return listing ? { ...listing, orders: [] } : null;
}

export function demoOrders(params: URLSearchParams, days: number, now = new Date()) {
  const status = params.get("status");
  const since = now.getTime() - days * DAY;
  const orders = buildDemoData(now)
    .orders.filter((o) => o.saleDate.getTime() >= since && (!status || o.status === status))
    .sort((a, b) => b.saleDate.getTime() - a.saleDate.getTime())
    .map((o) => ({ ...o, listing: null }));

  return {
    orders,
    demo: true as const,
    ...(params.get("sync") === "true" ? { notice: DEMO_SYNC_NOTICE } : {}),
  };
}

export function demoSales(days: number, now = new Date()) {
  return { ...buildSalesReport(buildDemoData(now).orders, days, now), demo: true as const };
}

function demoInventoryRows(params: URLSearchParams, now: Date) {
  return sortForInventoryList(filterInventory(buildDemoData(now).inventory, params)).map(withProfit);
}

export function demoInventory(params: URLSearchParams, now = new Date()) {
  const items = demoInventoryRows(params, now);
  const years = Array.from(
    new Set(
      buildDemoData(now)
        .inventory.filter((i) => i.soldDate)
        .map((i) => i.soldDate!.getUTCFullYear())
    )
  ).sort((a, b) => b - a);

  return { items, summary: summarize(items), years, demo: true as const };
}

export function demoInventoryItem(id: string, now = new Date()) {
  const item = buildDemoData(now).inventory.find((i) => i.id === id);
  return item ? withProfit(item) : null;
}

export function demoInventoryCsv(params: URLSearchParams, now = new Date()) {
  return toCsv(demoInventoryRows(params, now));
}
