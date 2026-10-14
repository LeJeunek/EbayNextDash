// In-memory twin of inventoryWhere(), so the demo filters exactly like Postgres does.
import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@prisma/client";
import { filterInventory } from "@/lib/inventory";

const base: InventoryItem = {
  id: "x", userId: "u", title: "", sku: null, category: null, condition: null,
  notes: null, purchaseDate: null, source: null, originalCost: 0, sellPrice: null,
  packingCost: 0, shippingCost: 0, ebayFee: 0, otherCost: 0, status: "LISTED",
  listedDate: null, soldDate: null, ebayListingId: null, ebayOrderId: null,
  createdAt: new Date(0), updatedAt: new Date(0),
};
const items: InventoryItem[] = [
  { ...base, id: "a", title: "Canon AE-1", category: "Cameras", status: "SOLD", soldDate: new Date("2026-03-14T00:00:00Z"), sellPrice: 185 },
  { ...base, id: "b", title: "GameCube", sku: "GC-01", status: "SOLD", soldDate: new Date("2025-12-31T23:00:00Z"), sellPrice: 120 },
  { ...base, id: "c", title: "Polaroid SX-70", source: "Estate SALE", status: "LISTED" },
  { ...base, id: "d", title: "Jacket", notes: "has a small CAMERA pin", status: "LISTED" },
];
const ids = (params: Record<string, string>) =>
  filterInventory(items, new URLSearchParams(params)).map((i) => i.id);

describe("filterInventory", () => {
  it("returns everything with no filters or ALL", () => {
    expect(ids({})).toEqual(["a", "b", "c", "d"]);
    expect(ids({ status: "ALL", year: "ALL" })).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by status and ignores unknown statuses, like parseStatus", () => {
    expect(ids({ status: "SOLD" })).toEqual(["a", "b"]);
    expect(ids({ status: "sold" })).toEqual(["a", "b"]);
    expect(ids({ status: "BOGUS" })).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by the UTC year an item sold, excluding unsold items", () => {
    expect(ids({ year: "2026" })).toEqual(["a"]);
    expect(ids({ year: "2025" })).toEqual(["b"]);
  });

  it("searches title, SKU, category, source and notes case-insensitively", () => {
    expect(ids({ q: "camera" })).toEqual(["a", "d"]); // category + notes
    expect(ids({ q: "gc-01" })).toEqual(["b"]);       // sku
    expect(ids({ q: "estate" })).toEqual(["c"]);      // source
  });

  it("combines filters", () => {
    expect(ids({ status: "LISTED", q: "camera" })).toEqual(["d"]);
  });
});
