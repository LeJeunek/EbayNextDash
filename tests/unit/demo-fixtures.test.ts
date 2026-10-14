// The sample data every demo screen is drawn from.
import { describe, expect, it } from "vitest";
import { DEMO_USER, buildDemoData } from "@/lib/demo/fixtures";
import { withProfit } from "@/lib/inventory";

const NOW = new Date("2026-10-05T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("DEMO_USER", () => {
  it("is clearly fictional", () => {
    expect(DEMO_USER.ebayUsername).toBe("demo_seller");
    // .example is reserved (RFC 2606), so it can never be someone's address.
    expect(DEMO_USER.email).toMatch(/\.example$/);
  });
});

describe("buildDemoData", () => {
  const data = buildDemoData(NOW);

  it("is deterministic for the same moment", () => {
    expect(JSON.stringify(buildDemoData(NOW))).toBe(JSON.stringify(data));
  });

  it("belongs entirely to the demo user", () => {
    for (const row of [...data.listings, ...data.orders, ...data.inventory]) {
      expect(row.userId).toBe(DEMO_USER.id);
    }
  });

  it("uses unique ids within each collection", () => {
    for (const rows of [data.listings, data.orders, data.inventory]) {
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    }
    expect(new Set(data.orders.map((o) => o.orderId)).size).toBe(data.orders.length);
    expect(new Set(data.listings.map((l) => l.ebayListingId)).size).toBe(data.listings.length);
  });

  it("has active listings to show", () => {
    expect(data.listings.filter((l) => l.status === "ACTIVE").length).toBeGreaterThanOrEqual(3);
  });

  it("fills the 30-day window and has older orders outside it", () => {
    const ages = data.orders.map((o) => (NOW.getTime() - o.saleDate.getTime()) / DAY);
    expect(ages.every((a) => a >= 0)).toBe(true); // nothing in the future
    expect(ages.filter((a) => a < 30).length).toBeGreaterThanOrEqual(5);
    expect(ages.some((a) => a >= 30)).toBe(true);
  });

  it("mixes sold and still-listed inventory, with realistic profits", () => {
    const sold = data.inventory.filter((i) => i.status === "SOLD");
    const listed = data.inventory.filter((i) => i.status === "LISTED");
    expect(sold.length).toBeGreaterThanOrEqual(5);
    expect(listed.length).toBeGreaterThanOrEqual(2);

    for (const item of sold) {
      expect(item.sellPrice).not.toBeNull();
      expect(item.soldDate!.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(withProfit(item).profit!).toBeGreaterThan(0);
    }
    for (const item of listed) {
      expect(item.sellPrice).toBeNull();
      expect(item.soldDate).toBeNull();
    }
  });

  it("moves with the clock, so the 30-day window never goes empty", () => {
    const later = buildDemoData(new Date(NOW.getTime() + 100 * DAY));
    const newest = (rows: { saleDate: Date }[]) => Math.max(...rows.map((r) => r.saleDate.getTime()));
    expect(newest(later.orders) - newest(data.orders)).toBe(100 * DAY);
  });

  it("only uses demo buyer names", () => {
    for (const order of data.orders) expect(order.buyerUsername).toMatch(/^demo_/);
  });
});
