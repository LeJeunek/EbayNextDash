// src/app/api/inventory/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await ownedItem(params.id, session.user.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ item: withProfit(item) });
}

// PATCH /api/inventory/[id] — inline edits from the table
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await ownedItem(params.id, session.user.id);
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await ownedItem(params.id, session.user.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.inventoryItem.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
