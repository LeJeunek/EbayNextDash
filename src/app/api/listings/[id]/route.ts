// src/app/api/listings/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { demoListing, demoReadOnly } from "@/lib/demo/responses";
import { getViewer } from "@/lib/viewer";
import { prisma } from "@/lib/prisma";
import { EbayApiClient } from "@/lib/ebay";
import { getEbayAccessToken } from "@/lib/ebay-token";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.kind === "demo") {
    const listing = demoListing(params.id);
    return listing ? NextResponse.json({ listing }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const userId = viewer.userId;

  const listing = await prisma.listing.findFirst({
    where: { id: params.id, userId: userId },
    include: { orders: { orderBy: { saleDate: "desc" } } },
  });

  if (!listing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ listing });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.kind === "demo") return demoReadOnly();
  const userId = viewer.userId;

  const existing = await prisma.listing.findFirst({
    where: { id: params.id, userId: userId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, price, quantity, status, condition, imageUrl } = body;

  const listing = await prisma.listing.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(quantity !== undefined && { quantity }),
      ...(status !== undefined && { status }),
      ...(condition !== undefined && { condition }),
      ...(imageUrl !== undefined && { imageUrl }),
    },
  });

  return NextResponse.json({ listing });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.kind === "demo") return demoReadOnly();
  const userId = viewer.userId;

  const existing = await prisma.listing.findFirst({
    where: { id: params.id, userId: userId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Try to delete from eBay too
  if (existing.ebayListingId) {
    try {
      const client = new EbayApiClient(await getEbayAccessToken(userId));
      await client.deleteListing(existing.ebayListingId);
    } catch (err) {
      console.error("eBay delete error:", err);
    }
  }

  await prisma.listing.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
