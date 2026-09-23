// src/app/api/listings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EbayApiClient, CreateListingPayload } from "@/lib/ebay";
import { getEbayAccessToken } from "@/lib/ebay-token";
import { saveActiveListings, type ListingsSyncResult } from "@/lib/listings-sync";

// GET /api/listings - fetch all listings for the authenticated user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const sync = searchParams.get("sync") === "true";

  // Optionally sync from eBay first. Uses the Trading API: the Inventory API
  // never returns listings created on eBay.com, so it silently found nothing.
  let syncError: string | null = null;
  let synced: ListingsSyncResult | null = null;
  if (sync) {
    try {
      const client = new EbayApiClient(await getEbayAccessToken(session.user.id));
      synced = await saveActiveListings(session.user.id, await client.getActiveListings());
    } catch (err) {
      console.error("eBay sync error:", err);
      syncError = err instanceof Error ? err.message : "eBay sync failed";
    }
  }

  const listings = await prisma.listing.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status: status as any } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { orders: true } },
    },
  });

  return NextResponse.json({
    listings,
    ...(syncError ? { syncError } : {}),
    ...(synced ? { synced } : {}),
  });
}

// POST /api/listings - create a new listing
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, price, quantity, condition, imageUrl, category } = body;

  if (!title || !price) {
    return NextResponse.json(
      { error: "Title and price are required" },
      { status: 400 }
    );
  }

  // Generate a SKU from title + timestamp
  const sku = `SKU-${Date.now()}-${title.slice(0, 10).replace(/\s+/g, "-").toUpperCase()}`;

  // Push to eBay API if token available
  let ebayListingId = sku;
  let ebayError: string | null = null;
  {
    try {
      const client = new EbayApiClient(await getEbayAccessToken(session.user.id));
      const payload: CreateListingPayload = {
        availability: {
          shipToLocationAvailability: { quantity: quantity || 1 },
        },
        condition: condition || "NEW",
        product: {
          title,
          description: description || "",
          ...(imageUrl ? { imageUrls: [imageUrl] } : {}),
        },
      };
      await client.createOrUpdateListing(sku, payload);
      ebayListingId = sku;
    } catch (err) {
      console.error("eBay create listing error:", err);
      // Fall through — still save locally, but say so.
      ebayError = err instanceof Error ? err.message : "eBay listing push failed";
    }
  }

  const listing = await prisma.listing.create({
    data: {
      ebayListingId,
      userId: session.user.id,
      title,
      description: description || null,
      price: parseFloat(price),
      quantity: quantity || 1,
      condition: condition || null,
      imageUrl: imageUrl || null,
      category: category || null,
      status: "ACTIVE",
    },
  });

  return NextResponse.json(
    { listing, ...(ebayError ? { ebayError } : {}) },
    { status: 201 }
  );
}
