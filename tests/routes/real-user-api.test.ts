// The same routes for a signed-in user: the refactor must not change their behaviour.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prisma, getEbayAccessToken } = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    prisma: {
      listing: { findMany: fn(), findFirst: fn(), count: fn() },
      order: { findMany: fn(), count: fn() },
      inventoryItem: { findMany: fn(), findFirst: fn(), create: fn(), update: fn(), delete: fn() },
    },
    getEbayAccessToken: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/ebay-token", () => ({ getEbayAccessToken }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/viewer", () => ({
  getViewer: vi.fn(async () => ({
    kind: "user",
    userId: "user_1",
    user: { name: "Real Seller", ebayUsername: "real_seller" },
  })),
}));

import * as listings from "@/app/api/listings/route";
import * as sales from "@/app/api/sales/route";
import * as inventory from "@/app/api/inventory/route";

const get = (path: string) => new NextRequest(`http://localhost${path}`);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

beforeEach(() => {
  for (const model of Object.values(prisma)) for (const f of Object.values(model)) f.mockReset();
  getEbayAccessToken.mockReset();
});

describe("signed-in user", () => {
  it("GET /api/listings reads their rows and does not call eBay without ?sync", async () => {
    prisma.listing.findMany.mockResolvedValue([{ id: "l1", title: "Real thing" }]);
    const body = await (await listings.GET(get("/api/listings"))).json();
    expect(body.listings).toEqual([{ id: "l1", title: "Real thing" }]);
    expect(body).not.toHaveProperty("demo");
    expect(prisma.listing.findMany.mock.calls[0][0].where.userId).toBe("user_1");
    expect(getEbayAccessToken).not.toHaveBeenCalled();
  });

  it("GET /api/sales still filters by user and builds the same report", async () => {
    prisma.order.findMany.mockResolvedValue([
      { saleDate: daysAgo(1), salePrice: 100, profit: 60, ebayFee: 13, shippingCost: 9, status: "PAID" },
    ]);
    const body = await (await sales.GET(get("/api/sales?days=7"))).json();
    expect(body.chartData).toHaveLength(7);
    expect(body.summary).toMatchObject({ totalRevenue: 100, totalProfit: 60, totalOrders: 1 });
    const where = prisma.order.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe("user_1");
    expect(where.status).toEqual({ notIn: ["CANCELLED", "REFUNDED"] });
  });

  it("GET /api/inventory returns their items with derived profit", async () => {
    const row = {
      id: "i1", userId: "user_1", title: "Lens", sku: null, category: null, condition: null,
      notes: null, purchaseDate: null, source: null, originalCost: 10, sellPrice: 50,
      packingCost: 2, shippingCost: 5, ebayFee: 6, otherCost: 0, status: "SOLD",
      listedDate: null, soldDate: daysAgo(3), ebayListingId: null, ebayOrderId: null,
      createdAt: daysAgo(10), updatedAt: daysAgo(3),
    };
    prisma.inventoryItem.findMany.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ soldDate: row.soldDate }]);
    const body = await (await inventory.GET(get("/api/inventory"))).json();
    expect(body.items[0].profit).toBe(27);
    expect(body).not.toHaveProperty("demo");
    expect(prisma.inventoryItem.findMany.mock.calls[0][0].where.userId).toBe("user_1");
  });

  it("POST /api/inventory still saves", async () => {
    prisma.inventoryItem.create.mockImplementation(async ({ data }: any) => ({
      id: "new", createdAt: new Date(), updatedAt: new Date(), sku: null, category: null,
      condition: null, notes: null, purchaseDate: null, source: null, listedDate: null,
      ebayListingId: null, ebayOrderId: null, ...data,
    }));
    const res = await inventory.POST(
      new NextRequest("http://localhost/api/inventory", {
        method: "POST",
        body: JSON.stringify({ title: "Tripod", originalCost: "12" }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(201);
    expect(prisma.inventoryItem.create.mock.calls[0][0].data.userId).toBe("user_1");
  });
});
