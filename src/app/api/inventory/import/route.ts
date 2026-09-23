// src/app/api/inventory/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCsv, parseDate, parseMoney, parseStatus } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/** One paste writes one row per line, so cap it rather than accept anything. */
const MAX_IMPORT_ROWS = 2000;

/** Header text → field name. Matched case-insensitively, punctuation stripped. */
const HEADER_MAP: Record<string, string> = {
  title: "title",
  item: "title",
  itemtitle: "title",
  name: "title",
  sku: "sku",
  category: "category",
  condition: "condition",
  source: "source",
  boughtfrom: "source",
  purchasedate: "purchaseDate",
  datepurchased: "purchaseDate",
  bought: "purchaseDate",
  listeddate: "listedDate",
  solddate: "soldDate",
  datesold: "soldDate",
  sold: "soldDate",
  status: "status",
  originalcost: "originalCost",
  cost: "originalCost",
  itemcost: "originalCost",
  purchaseprice: "originalCost",
  sellprice: "sellPrice",
  saleprice: "sellPrice",
  soldfor: "sellPrice",
  packingcost: "packingCost",
  packaging: "packingCost",
  packingsupplies: "packingCost",
  shippingcost: "shippingCost",
  shipping: "shippingCost",
  postage: "shippingCost",
  ebayfees: "ebayFee",
  ebayfee: "ebayFee",
  fees: "ebayFee",
  othercost: "otherCost",
  other: "otherCost",
  notes: "notes",
};

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * POST /api/inventory/import
 *   { csv: "..." }             — paste a spreadsheet export
 *   { fromOrders: true, days } — seed rows from already-synced eBay orders
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.fromOrders) {
    return importFromOrders(userId, parseInt(body.days, 10) || 365);
  }

  if (typeof body.csv !== "string" || !body.csv.trim()) {
    return NextResponse.json({ error: "Nothing to import" }, { status: 400 });
  }

  const rows = parseCsv(body.csv);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "Need a header row plus at least one data row" },
      { status: 400 }
    );
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `Too many rows — import at most ${MAX_IMPORT_ROWS} at a time.` },
      { status: 400 }
    );
  }

  const headers = rows[0].map((h) => HEADER_MAP[normalizeHeader(h)] || null);
  if (!headers.includes("title")) {
    return NextResponse.json(
      { error: "No 'Title' column found in the header row" },
      { status: 400 }
    );
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const [index, row] of rows.slice(1).entries()) {
    const record: Record<string, string> = {};
    headers.forEach((field, i) => {
      if (field) record[field] = (row[i] ?? "").trim();
    });

    if (!record.title) {
      skipped.push(`Row ${index + 2}: no title`);
      continue;
    }

    const sellPrice = parseMoney(record.sellPrice, null);
    const soldDate = parseDate(record.soldDate);
    // A row with a sale price is a sale, whether or not the sheet said so.
    const status =
      parseStatus(record.status) ?? (sellPrice !== null ? "SOLD" : "LISTED");

    const item = await prisma.inventoryItem.create({
      data: {
        userId,
        title: record.title,
        sku: record.sku || null,
        category: record.category || null,
        condition: record.condition || null,
        source: record.source || null,
        notes: record.notes || null,
        purchaseDate: parseDate(record.purchaseDate),
        listedDate: parseDate(record.listedDate),
        soldDate: soldDate ?? (status === "SOLD" ? new Date() : null),
        originalCost: parseMoney(record.originalCost, 0),
        sellPrice,
        packingCost: parseMoney(record.packingCost, 0),
        shippingCost: parseMoney(record.shippingCost, 0),
        ebayFee: parseMoney(record.ebayFee, 0),
        otherCost: parseMoney(record.otherCost, 0),
        status,
      },
    });
    created.push(item.id);
  }

  return NextResponse.json({ imported: created.length, skipped });
}

/**
 * Seed inventory rows from orders already pulled down from eBay. Sale price,
 * shipping and fees come across; original cost and packing stay at 0 for the
 * seller to fill in, since eBay never knew them.
 */
async function importFromOrders(userId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const orders = await prisma.order.findMany({
    where: {
      userId,
      saleDate: { gte: since },
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
    orderBy: { saleDate: "desc" },
  });

  if (orders.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped: ["No eBay orders found — sync your orders first."],
    });
  }

  // Don't duplicate orders that were imported on an earlier run.
  const existing = await prisma.inventoryItem.findMany({
    where: { userId, ebayOrderId: { in: orders.map((o) => o.orderId) } },
    select: { ebayOrderId: true },
  });
  const alreadyImported = new Set(existing.map((e) => e.ebayOrderId));

  const fresh = orders.filter((o) => !alreadyImported.has(o.orderId));

  if (fresh.length) {
    await prisma.inventoryItem.createMany({
      data: fresh.map((o) => ({
        userId,
        title: o.itemTitle,
        status: "SOLD" as const,
        soldDate: o.saleDate,
        sellPrice: o.salePrice,
        shippingCost: o.shippingCost,
        ebayFee: o.ebayFee,
        originalCost: 0,
        packingCost: 0,
        ebayOrderId: o.orderId,
        notes: "Imported from eBay order — fill in your original cost.",
      })),
    });
  }

  return NextResponse.json({
    imported: fresh.length,
    skipped:
      alreadyImported.size > 0
        ? [`${alreadyImported.size} order(s) already imported`]
        : [],
  });
}
