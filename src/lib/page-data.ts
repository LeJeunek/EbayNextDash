// src/lib/page-data.ts
//
// Data for the two server-rendered pages — the dashboard overview and the
// print summary — for either kind of viewer. Real users get the Prisma
// queries these pages always ran; demo visitors get the same figures computed
// from fixtures under the same rules, with no database access at all.
import { startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { inventoryWhere, filterInventory, summarize, withProfit } from "@/lib/inventory";
import { buildDemoData } from "@/lib/demo/fixtures";
import { sortForPrint } from "@/lib/demo/responses";
import type { Viewer } from "@/lib/viewer";

const NOT_COUNTED = ["CANCELLED", "REFUNDED"];

export type RecentOrder = {
  orderId: string;
  itemTitle: string;
  salePrice: number;
  status: string;
  saleDate: Date;
};

export type Overview = {
  activeListings: number;
  totalOrders: number;
  revenue30: number;
  profit30: number;
  recentOrders: RecentOrder[];
  /** Ledger net profit for items sold this calendar year (UTC). */
  trackedProfit: number;
  year: number;
};

export async function loadOverview(viewer: Viewer, now = new Date()): Promise<Overview> {
  const since30 = startOfDay(subDays(now, 29));
  const year = now.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));

  let activeListings: number;
  let totalOrders: number;
  let orders30: { salePrice: number; profit: number }[];
  let recentOrders: RecentOrder[];
  let inventoryYtd: Parameters<typeof withProfit>[0][];

  if (viewer.kind === "demo") {
    const fx = buildDemoData(now);
    activeListings = fx.listings.filter((l) => l.status === "ACTIVE").length;
    totalOrders = fx.orders.length;
    orders30 = fx.orders.filter((o) => o.saleDate >= since30 && !NOT_COUNTED.includes(o.status));
    recentOrders = [...fx.orders]
      .sort((a, b) => b.saleDate.getTime() - a.saleDate.getTime())
      .slice(0, 5)
      .map(({ orderId, itemTitle, salePrice, status, saleDate }) => ({ orderId, itemTitle, salePrice, status, saleDate }));
    inventoryYtd = fx.inventory.filter((i) => i.soldDate && i.soldDate >= yearStart);
  } else {
    const { userId } = viewer;
    [activeListings, totalOrders, orders30, recentOrders, inventoryYtd] = await Promise.all([
      prisma.listing.count({ where: { userId, status: "ACTIVE" } }),
      prisma.order.count({ where: { userId } }),
      prisma.order.findMany({
        where: { userId, saleDate: { gte: since30 }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
        select: { salePrice: true, profit: true },
      }),
      prisma.order.findMany({
        where: { userId },
        orderBy: { saleDate: "desc" },
        take: 5,
        select: { orderId: true, itemTitle: true, salePrice: true, status: true, saleDate: true },
      }),
      prisma.inventoryItem.findMany({ where: { userId, soldDate: { gte: yearStart } } }),
    ]);
  }

  return {
    activeListings,
    totalOrders,
    revenue30: orders30.reduce((s, o) => s + o.salePrice, 0),
    profit30: orders30.reduce((s, o) => s + o.profit, 0),
    recentOrders,
    trackedProfit: summarize(inventoryYtd.map(withProfit)).netProfit,
    year,
  };
}

export async function loadPrintInventory(viewer: Viewer, params: URLSearchParams, now = new Date()) {
  if (viewer.kind === "demo") {
    return {
      items: sortForPrint(filterInventory(buildDemoData(now).inventory, params)).map(withProfit),
      seller: viewer.user.ebayUsername,
    };
  }

  const rows = await prisma.inventoryItem.findMany({
    where: inventoryWhere(viewer.userId, params),
    orderBy: [{ soldDate: "asc" }, { createdAt: "asc" }],
  });
  return {
    items: rows.map(withProfit),
    seller: viewer.user.ebayUsername || viewer.user.name || "Seller",
  };
}
