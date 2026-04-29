// src/app/api/listings/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EbayApiClient } from "@/lib/ebay";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const listing = await prisma.listing.findFirst({
    where: { id: params.id, userId: session.user.id },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.listing.findFirst({
    where: { id: params.id, userId: session.user.id },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.listing.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Try to delete from eBay too
  if (session.accessToken && existing.ebayListingId) {
    try {
      const client = new EbayApiClient(session.accessToken);
      await client.deleteListing(existing.ebayListingId);
    } catch (err) {
      console.error("eBay delete error:", err);
    }
  }

  await prisma.listing.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
