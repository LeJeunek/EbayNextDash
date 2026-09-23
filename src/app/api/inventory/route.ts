// src/app/api/inventory/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  inventoryWhere,
  parseDate,
  parseMoney,
  parseStatus,
  summarize,
  withProfit,
} from "@/lib/inventory";

export const dynamic = "force-dynamic";

// GET /api/inventory — list rows plus a rolled-up summary
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  const items = await prisma.inventoryItem.findMany({
    where: inventoryWhere(session.user.id, searchParams),
    orderBy: [{ soldDate: "desc" }, { createdAt: "desc" }],
  });

  const withDerived = items.map(withProfit);

  // Every year that has at least one sale, for the year picker.
  const years = await prisma.inventoryItem.findMany({
    where: { userId: session.user.id, soldDate: { not: null } },
    select: { soldDate: true },
    orderBy: { soldDate: "desc" },
  });
  const yearList = Array.from(
    new Set(years.map((y) => y.soldDate!.getUTCFullYear()))
  );

  return NextResponse.json({
    items: withDerived,
    summary: summarize(withDerived),
    years: yearList,
  });
}

// POST /api/inventory — add a row by hand
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const status = parseStatus(body.status) ?? "LISTED";
  const sellPrice = parseMoney(body.sellPrice, null);
  const soldDate = parseDate(body.soldDate);

  const item = await prisma.inventoryItem.create({
    data: {
      userId: session.user.id,
      title: body.title.trim(),
      sku: body.sku?.trim() || null,
      category: body.category?.trim() || null,
      condition: body.condition?.trim() || null,
      source: body.source?.trim() || null,
      notes: body.notes?.trim() || null,
      purchaseDate: parseDate(body.purchaseDate),
      listedDate: parseDate(body.listedDate),
      // Marking something sold without a date would drop it out of every
      // tax-year view, so fall back to today.
      soldDate: soldDate ?? (status === "SOLD" ? new Date() : null),
      originalCost: parseMoney(body.originalCost, 0),
      sellPrice,
      packingCost: parseMoney(body.packingCost, 0),
      shippingCost: parseMoney(body.shippingCost, 0),
      ebayFee: parseMoney(body.ebayFee, 0),
      otherCost: parseMoney(body.otherCost, 0),
      status,
      ebayListingId: body.ebayListingId?.trim() || null,
      ebayOrderId: body.ebayOrderId?.trim() || null,
    },
  });

  return NextResponse.json({ item: withProfit(item) }, { status: 201 });
}
