// Every API route, called as a demo visitor.
//
// The point of these tests: however a demo visitor clicks around — including
// hammering the sync buttons — the app makes ZERO calls to eBay and ZERO reads
// or writes against the database. Any access to either fails the suite.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prisma, prismaAccess, getEbayAccessToken, fetchSpy } = vi.hoisted(() => {
  const prismaAccess: string[] = [];
  // Records every touch. Calling any method throws, so a demo code path that
  // reaches the database fails loudly instead of silently returning nothing.
  const prisma = new Proxy({} as any, {
    get(_t, model) {
      if (typeof model === "symbol" || model === "then") return undefined;
      prismaAccess.push(String(model));
      return new Proxy({} as any, {
        get(_t2, op) {
          if (typeof op === "symbol" || op === "then") return undefined;
          prismaAccess.push(`${String(model)}.${String(op)}`);
          return () => {
            throw new Error(`demo touched prisma.${String(model)}.${String(op)}`);
          };
        },
      });
    },
  });
  return {
    prisma,
    prismaAccess,
    getEbayAccessToken: vi.fn(async () => {
      throw new Error("demo asked for an eBay token");
    }),
    fetchSpy: vi.fn(async () => {
      throw new Error("demo made a network call");
    }),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/ebay-token", () => ({ getEbayAccessToken }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/viewer", async () => {
  const { DEMO_USER } = await import("@/lib/demo/fixtures");
  return { getViewer: vi.fn(async () => ({ kind: "demo", user: DEMO_USER })) };
});
vi.stubGlobal("fetch", fetchSpy);

import { DEMO_READ_ONLY_MESSAGE, DEMO_SYNC_NOTICE } from "@/lib/demo/config";
import { buildDemoData } from "@/lib/demo/fixtures";
import { getViewer } from "@/lib/viewer";
import * as listings from "@/app/api/listings/route";
import * as listingById from "@/app/api/listings/[id]/route";
import * as orders from "@/app/api/orders/route";
import * as sales from "@/app/api/sales/route";
import * as inventory from "@/app/api/inventory/route";
import * as inventoryById from "@/app/api/inventory/[id]/route";
import * as inventoryExport from "@/app/api/inventory/export/route";
import * as inventoryImport from "@/app/api/inventory/import/route";

const fx = buildDemoData(new Date());
const url = (path: string) => `http://localhost${path}`;
const get = (path: string) => new NextRequest(url(path));
const send = (path: string, method: string, body: unknown = {}) =>
  new NextRequest(url(path), {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const ctx = (id: string) => ({ params: { id } });

function expectNothingLeftTheApp() {
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(getEbayAccessToken).not.toHaveBeenCalled();
  expect(prismaAccess).toEqual([]);
}

beforeEach(() => {
  prismaAccess.length = 0;
  fetchSpy.mockClear();
  getEbayAccessToken.mockClear();
});
afterAll(() => vi.unstubAllGlobals());

describe("listings", () => {
  it("GET returns the demo listings, with order counts", async () => {
    const body = await (await listings.GET(get("/api/listings"))).json();
    expect(body.demo).toBe(true);
    expect(body.listings).toHaveLength(fx.listings.length);
    expect(body.listings[0]).toHaveProperty("_count.orders");
    expectNothingLeftTheApp();
  });

  it("GET filters by status", async () => {
    const body = await (await listings.GET(get("/api/listings?status=ACTIVE"))).json();
    expect(body.listings.every((l: any) => l.status === "ACTIVE")).toBe(true);
    expect(body.listings.length).toBe(fx.listings.filter((l) => l.status === "ACTIVE").length);
  });

  it("sync is simulated: a notice, no eBay call", async () => {
    const body = await (await listings.GET(get("/api/listings?sync=true"))).json();
    expect(body.notice).toBe(DEMO_SYNC_NOTICE);
    expect(body).not.toHaveProperty("syncError");
    expect(body).not.toHaveProperty("synced");
    expectNothingLeftTheApp();
  });

  it("POST is refused as read-only", async () => {
    const res = await listings.POST(send("/api/listings", "POST", { title: "x", price: 1 }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(DEMO_READ_ONLY_MESSAGE);
    expectNothingLeftTheApp();
  });

  it("GET /[id] returns a demo listing, or 404", async () => {
    const id = fx.listings[0].id;
    const ok = await listingById.GET(get(`/api/listings/${id}`), ctx(id));
    expect((await ok.json()).listing.id).toBe(id);
    expect((await listingById.GET(get("/api/listings/nope"), ctx("nope"))).status).toBe(404);
    expectNothingLeftTheApp();
  });

  it("PATCH and DELETE /[id] are refused", async () => {
    const id = fx.listings[0].id;
    expect((await listingById.PATCH(send(`/api/listings/${id}`, "PATCH", { title: "y" }), ctx(id))).status).toBe(403);
    expect((await listingById.DELETE(send(`/api/listings/${id}`, "DELETE"), ctx(id))).status).toBe(403);
    expectNothingLeftTheApp();
  });
});

describe("orders", () => {
  it("GET returns the last 30 days, newest first", async () => {
    const body = await (await orders.GET(get("/api/orders"))).json();
    expect(body.demo).toBe(true);
    const dates = body.orders.map((o: any) => new Date(o.saleDate).getTime());
    expect(dates.length).toBeGreaterThan(0);
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    expect(dates.every((d: number) => Date.now() - d < 30 * 86_400_000)).toBe(true);
    expect(body.orders[0]).toHaveProperty("listing");
    expectNothingLeftTheApp();
  });

  it("a wider ?days window returns more", async () => {
    const d30 = (await (await orders.GET(get("/api/orders"))).json()).orders.length;
    const d365 = (await (await orders.GET(get("/api/orders?days=365"))).json()).orders.length;
    expect(d365).toBeGreaterThan(d30);
  });

  it("sync is simulated", async () => {
    const body = await (await orders.GET(get("/api/orders?sync=true"))).json();
    expect(body.notice).toBe(DEMO_SYNC_NOTICE);
    expectNothingLeftTheApp();
  });
});

describe("sales", () => {
  it("GET builds the chart from demo orders", async () => {
    const body = await (await sales.GET(get("/api/sales?days=30"))).json();
    expect(body.chartData).toHaveLength(30);
    expect(body.summary.totalOrders).toBeGreaterThan(0);
    expect(body.summary.totalRevenue).toBeGreaterThan(0);
    expectNothingLeftTheApp();
  });
});

describe("inventory", () => {
  it("GET returns items with profit, a summary and the year list", async () => {
    const body = await (await inventory.GET(get("/api/inventory"))).json();
    expect(body.demo).toBe(true);
    expect(body.items).toHaveLength(fx.inventory.length);
    expect(body.items.find((i: any) => i.status === "SOLD")).toHaveProperty("profit");
    expect(body.summary.netProfit).toBeGreaterThan(0);
    expect(body.years.length).toBeGreaterThan(0);
    expectNothingLeftTheApp();
  });

  it("GET lists unsold items first, then newest sale — matching Postgres DESC NULLS FIRST", async () => {
    const { items } = await (await inventory.GET(get("/api/inventory"))).json();
    const firstSold = items.findIndex((i: any) => i.soldDate);
    expect(items.slice(0, firstSold).every((i: any) => !i.soldDate)).toBe(true);
    const sold = items.slice(firstSold).map((i: any) => new Date(i.soldDate).getTime());
    expect([...sold].sort((a, b) => b - a)).toEqual(sold);
  });

  it("GET honours status and search filters", async () => {
    const sold = await (await inventory.GET(get("/api/inventory?status=SOLD"))).json();
    expect(sold.items.every((i: any) => i.status === "SOLD")).toBe(true);
    const title = fx.inventory[0].title.split(" ")[0];
    const found = await (await inventory.GET(get(`/api/inventory?q=${encodeURIComponent(title)}`))).json();
    expect(found.items.length).toBeGreaterThan(0);
  });

  it("GET /[id] returns one item, or 404", async () => {
    const id = fx.inventory[0].id;
    expect((await (await inventoryById.GET(get(`/api/inventory/${id}`), ctx(id))).json()).item.id).toBe(id);
    expect((await inventoryById.GET(get("/api/inventory/nope"), ctx("nope"))).status).toBe(404);
  });

  it("every write is refused", async () => {
    const id = fx.inventory[0].id;
    const writes = [
      inventory.POST(send("/api/inventory", "POST", { title: "x" })),
      inventoryById.PATCH(send(`/api/inventory/${id}`, "PATCH", { originalCost: "1" }), ctx(id)),
      inventoryById.DELETE(send(`/api/inventory/${id}`, "DELETE"), ctx(id)),
      inventoryImport.POST(send("/api/inventory/import", "POST", { fromOrders: true })),
      inventoryImport.POST(send("/api/inventory/import", "POST", { csv: "Title\nThing" })),
    ];
    for (const res of await Promise.all(writes)) {
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe(DEMO_READ_ONLY_MESSAGE);
    }
    expectNothingLeftTheApp();
  });

  it("export returns a CSV of the demo data", async () => {
    const res = await inventoryExport.GET(get("/api/inventory/export"));
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const lines = (await res.text()).split("\r\n");
    expect(lines[0]).toMatch(/^Title,SKU,/);
    expect(lines).toHaveLength(fx.inventory.length + 1);
    expectNothingLeftTheApp();
  });
});

describe("spam resistance", () => {
  it("100 simultaneous sync clicks still make zero eBay calls and zero database queries", async () => {
    const burst = Array.from({ length: 50 }, () => [
      listings.GET(get("/api/listings?sync=true")),
      orders.GET(get("/api/orders?sync=true")),
    ]).flat();
    const responses = await Promise.all(burst);
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expectNothingLeftTheApp();
  });
});

describe("anonymous visitors", () => {
  it("get 401 from every route", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);
    const calls = [
      listings.GET(get("/api/listings")),
      orders.GET(get("/api/orders")),
      sales.GET(get("/api/sales")),
      inventory.GET(get("/api/inventory")),
      inventoryExport.GET(get("/api/inventory/export")),
      inventoryImport.POST(send("/api/inventory/import", "POST", { csv: "x" })),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
  });
});
