// src/lib/inventory.ts
import type { InventoryItem, Prisma } from "@prisma/client";

export const INVENTORY_STATUSES = [
  "DRAFT",
  "LISTED",
  "SOLD",
  "RETURNED",
  "UNSOLD",
] as const;

export type InventoryStatusValue = (typeof INVENTORY_STATUSES)[number];

/** Every cost that comes out of a sale, before profit. */
export function totalCost(item: {
  originalCost: number;
  packingCost: number;
  shippingCost: number;
  ebayFee: number;
  otherCost: number;
}) {
  return (
    item.originalCost +
    item.packingCost +
    item.shippingCost +
    item.ebayFee +
    item.otherCost
  );
}

/**
 * Profit = sell price − (original cost + packing + shipping + fees + other).
 * Returns null while the item has no sale price, so the UI can show "—"
 * instead of a misleading negative number for something still on the shelf.
 */
export function profitOf(item: {
  sellPrice: number | null;
  originalCost: number;
  packingCost: number;
  shippingCost: number;
  ebayFee: number;
  otherCost: number;
}) {
  if (item.sellPrice === null || item.sellPrice === undefined) return null;
  return round2(item.sellPrice - totalCost(item));
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type InventoryItemWithProfit = InventoryItem & {
  totalCost: number;
  profit: number | null;
  margin: number | null;
};

/** Attach the derived money fields the client and the print view both need. */
export function withProfit(item: InventoryItem): InventoryItemWithProfit {
  const cost = round2(totalCost(item));
  const profit = profitOf(item);
  return {
    ...item,
    totalCost: cost,
    profit,
    margin:
      profit !== null && item.sellPrice ? round2((profit / item.sellPrice) * 100) : null,
  };
}

/** Roll a set of rows up into the numbers a tax summary needs. */
export function summarize(items: InventoryItemWithProfit[]) {
  const sold = items.filter((i) => i.profit !== null);
  const grossSales = sold.reduce((s, i) => s + (i.sellPrice || 0), 0);
  const costOfGoods = sold.reduce((s, i) => s + i.originalCost, 0);
  const packing = sold.reduce((s, i) => s + i.packingCost, 0);
  const shipping = sold.reduce((s, i) => s + i.shippingCost, 0);
  const fees = sold.reduce((s, i) => s + i.ebayFee, 0);
  const other = sold.reduce((s, i) => s + i.otherCost, 0);
  const netProfit = sold.reduce((s, i) => s + (i.profit || 0), 0);

  // Money tied up in things that have not sold yet.
  const unsold = items.filter((i) => i.profit === null);
  const unsoldCost = unsold.reduce((s, i) => s + totalCost(i), 0);

  return {
    itemCount: items.length,
    soldCount: sold.length,
    unsoldCount: unsold.length,
    grossSales: round2(grossSales),
    costOfGoods: round2(costOfGoods),
    packing: round2(packing),
    shipping: round2(shipping),
    fees: round2(fees),
    other: round2(other),
    totalExpenses: round2(costOfGoods + packing + shipping + fees + other),
    netProfit: round2(netProfit),
    margin: grossSales > 0 ? round2((netProfit / grossSales) * 100) : 0,
    unsoldCost: round2(unsoldCost),
  };
}

export type InventorySummary = ReturnType<typeof summarize>;

// ─── Parsing helpers for the API ─────────────────────────────────────────────

/** Accept "12.34", "$12.34", "1,234.56", 12.34 — reject anything else. */
export function parseMoney(value: unknown, fallback: number): number;
export function parseMoney(value: unknown, fallback: null): number | null;
export function parseMoney(
  value: unknown,
  fallback: number | null
): number | null {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? round2(value) : fallback;
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? round2(n) : fallback;
}

export function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseStatus(value: unknown): InventoryStatusValue | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase() as InventoryStatusValue;
  return INVENTORY_STATUSES.includes(upper) ? upper : null;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export const CSV_COLUMNS = [
  "Title",
  "SKU",
  "Category",
  "Condition",
  "Source",
  "Purchase Date",
  "Listed Date",
  "Sold Date",
  "Status",
  "Original Cost",
  "Sell Price",
  "Packing Cost",
  "Shipping Cost",
  "eBay Fees",
  "Other Cost",
  "Total Cost",
  "Profit",
  "Notes",
] as const;

function csvCell(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isoDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function toCsv(items: InventoryItemWithProfit[]) {
  const rows = items.map((i) =>
    [
      i.title,
      i.sku,
      i.category,
      i.condition,
      i.source,
      isoDate(i.purchaseDate),
      isoDate(i.listedDate),
      isoDate(i.soldDate),
      i.status,
      i.originalCost.toFixed(2),
      i.sellPrice === null ? "" : i.sellPrice.toFixed(2),
      i.packingCost.toFixed(2),
      i.shippingCost.toFixed(2),
      i.ebayFee.toFixed(2),
      i.otherCost.toFixed(2),
      i.totalCost.toFixed(2),
      i.profit === null ? "" : i.profit.toFixed(2),
      i.notes,
    ]
      .map(csvCell)
      .join(",")
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n");
}

/** Minimal RFC-4180 CSV reader — handles quoted cells, embedded commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") {
      cell += c;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

// ─── Query filter shared by the list, export and print views ─────────────────

/** Build the status / tax-year / search filter from URL params. */
export function inventoryWhere(
  userId: string,
  searchParams: URLSearchParams
): Prisma.InventoryItemWhereInput {
  const status = searchParams.get("status");
  const year = searchParams.get("year");
  const q = searchParams.get("q");

  const where: Prisma.InventoryItemWhereInput = { userId };

  if (status && status !== "ALL") {
    const parsed = parseStatus(status);
    if (parsed) where.status = parsed;
  }

  if (year && year !== "ALL") {
    const y = parseInt(year, 10);
    if (Number.isFinite(y)) {
      // A tax year is defined by when the item sold. Rows that have not sold
      // have no sold date, so they only show up under "All years".
      where.soldDate = {
        gte: new Date(Date.UTC(y, 0, 1)),
        lt: new Date(Date.UTC(y + 1, 0, 1)),
      };
    }
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { source: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}
