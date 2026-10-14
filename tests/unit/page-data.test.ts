// Data behind the two server-rendered pages: the dashboard overview and the print summary.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, prismaAccess } = vi.hoisted(() => {
  const prismaAccess: string[] = [];
  const models: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const prisma = new Proxy({} as any, {
    get(_t, model) {
      if (typeof model === "symbol" || model === "then") return undefined;
      prismaAccess.push(String(model));
      return (models[String(model)] ??= new Proxy({} as any, {
        get(target, op) {
          if (typeof op === "symbol" || op === "then") return undefined;
          return (target[op] ??= vi.fn());
        },
      }));
    },
  });
  return { prisma, prismaAccess };
});
vi.mock("@/lib/prisma", () => ({ prisma }));

import { loadOverview, loadPrintInventory } from "@/lib/page-data";
import { DEMO_USER, buildDemoData } from "@/lib/demo/fixtures";
import { summarize, withProfit } from "@/lib/inventory";

const NOW = new Date("2026-10-05T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const demo = { kind: "demo" as const, user: DEMO_USER };
const user = { kind: "user" as const, userId: "user_1", user: { name: "Real" } };

beforeEach(() => {
  prismaAccess.length = 0;
});

describe("loadOverview — demo", () => {
  const fx = buildDemoData(NOW);

  it("never touches the database", async () => {
    await loadOverview(demo, NOW);
    expect(prismaAccess).toEqual([]);
  });

  it("derives every figure from the fixtures with the real queries' rules", async () => {
    const o = await loadOverview(demo, NOW);
    const in30 = fx.orders.filter(
      (x) => NOW.getTime() - x.saleDate.getTime() < 30 * DAY && !["CANCELLED", "REFUNDED"].includes(x.status)
    );
    expect(o.activeListings).toBe(fx.listings.filter((l) => l.status === "ACTIVE").length);
    expect(o.totalOrders).toBe(fx.orders.length);
    expect(o.revenue30).toBeCloseTo(in30.reduce((s, x) => s + x.salePrice, 0), 2);
    expect(o.profit30).toBeCloseTo(in30.reduce((s, x) => s + x.profit, 0), 2);
    expect(o.trackedProfit).toBeCloseTo(
      summarize(fx.inventory.filter((i) => i.soldDate && i.soldDate.getUTCFullYear() === 2026).map(withProfit)).netProfit,
      2
    );
    expect(o.year).toBe(2026);
  });

  it("lists the five newest orders, newest first", async () => {
    const { recentOrders } = await loadOverview(demo, NOW);
    expect(recentOrders).toHaveLength(5);
    const times = recentOrders.map((r) => r.saleDate.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });
});

describe("loadOverview — signed-in user", () => {
  it("queries that user's rows", async () => {
    prisma.listing.count.mockResolvedValue(4);
    prisma.order.count.mockResolvedValue(9);
    prisma.order.findMany
      .mockResolvedValueOnce([{ salePrice: 100, profit: 40 }, { salePrice: 20, profit: 5 }])
      .mockResolvedValueOnce([]);
    prisma.inventoryItem.findMany.mockResolvedValue([]);

    const o = await loadOverview(user, NOW);
    expect(o).toMatchObject({ activeListings: 4, totalOrders: 9, revenue30: 120, profit30: 45 });
    expect(prisma.listing.count).toHaveBeenCalledWith({ where: { userId: "user_1", status: "ACTIVE" } });
  });
});

describe("loadPrintInventory", () => {
  it("demo: filters by year, sorts oldest sale first, never touches the database", async () => {
    const { items, seller } = await loadPrintInventory(demo, new URLSearchParams({ year: "2026" }));
    expect(seller).toBe("demo_seller");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.soldDate!.getUTCFullYear() === 2026)).toBe(true);
    const times = items.map((i) => i.soldDate!.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(prismaAccess).toEqual([]);
  });

  it("demo: unsold items sort after sold ones, like Postgres NULLS LAST", async () => {
    const { items } = await loadPrintInventory(demo, new URLSearchParams());
    const firstUnsold = items.findIndex((i) => !i.soldDate);
    expect(firstUnsold).toBeGreaterThan(0);
    expect(items.slice(firstUnsold).every((i) => !i.soldDate)).toBe(true);
  });

  it("signed-in user: reads their rows", async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([]);
    const { seller } = await loadPrintInventory(
      { kind: "user", userId: "user_1", user: { ebayUsername: "real_seller" } },
      new URLSearchParams()
    );
    expect(seller).toBe("real_seller");
    expect(prisma.inventoryItem.findMany.mock.calls[0][0].where.userId).toBe("user_1");
  });
});
