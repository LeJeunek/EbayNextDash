// src/app/api/inventory/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { demoInventoryItem, demoReadOnly } from "@/lib/demo/responses";
import { Prisma } from "@prisma/client";
import { getViewer } from "@/lib/viewer";
import { prisma } from "@/lib/prisma";
import { parseDate, parseMoney, parseStatus, withProfit } from "@/lib/inventory";

export const dynamic = "force-dynamic";

async function ownedItem(id: string, userId: string) {
  return prisma.inventoryItem.findFirst({ where: { id, userId } });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.kind === "demo") {
    const item = demoInventoryItem(params.id);
    return item ? NextResponse.json({ item }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const userId = viewer.userId;

  const item = await ownedItem(params.id, userId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ item: withProfit(item) });
}

// PATCH /api/inventory/[id] — inline edits from the table
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.kind === "demo") return demoReadOnly();
  const userId = viewer.userId;

  const existing = await ownedItem(params.id, userId);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Prisma.InventoryItemUpdateInput = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title)
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    data.title = title;
  }

  for (const field of ["sku", "category", "condition", "source", "notes", "ebayListingId", "ebayOrderId"] as const) {
    if (body[field] !== undefined) {
      data[field] = String(body[field]).trim() || null;
    }
  }

  for (const field of ["originalCost", "packingCost", "shippingCost", "ebayFee", "otherCost"] as const) {
    if (body[field] !== undefined) {
      data[field] = parseMoney(body[field], existing[field]);
    }
  }

  // Clearing the sell price puts the item back to "not sold yet".
  if (body.sellPrice !== undefined) {
    data.sellPrice = parseMoney(body.sellPrice, null);
  }

  for (const field of ["purchaseDate", "listedDate", "soldDate"] as const) {
    if (body[field] !== undefined) {
      data[field] = parseDate(body[field]);
    }
  }

  if (body.status !== undefined) {
    const status = parseStatus(body.status);
    if (!status)
      return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    data.status = status;
    // Same guard as on create: a sold row always needs a date to land in a year.
    if (status === "SOLD" && body.soldDate === undefined && !existing.soldDate) {
      data.soldDate = new Date();
    }
  }

  const item = await prisma.inventoryItem.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ item: withProfit(item) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.kind === "demo") return demoReadOnly();
  const userId = viewer.userId;

  const existing = await ownedItem(params.id, userId);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.inventoryItem.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
