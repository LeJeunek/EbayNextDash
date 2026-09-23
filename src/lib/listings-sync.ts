// src/lib/listings-sync.ts
import { prisma } from "./prisma";
import type { ActiveListing } from "./ebay";

/**
 * eBay item IDs are all digits. Listings created from this app's New Listing
 * form are keyed by a generated "SKU-…" instead, and are never touched here.
 */
const EBAY_ITEM_ID = /^\d+$/;

export type ListingsSyncResult = {
  /** Active listings eBay returned. */
  found: number;
  created: number;
  updated: number;
  /** Previously synced listings that are no longer active on eBay. */
  ended: number;
  /** Listings already stored against a different user of this app. */
  skipped: number;
};

/**
 * Store the active listings from eBay for one user, and mark listings this sync
 * brought in before but eBay no longer reports as active as ENDED.
 */
export async function saveActiveListings(
  userId: string,
  active: ActiveListing[]
): Promise<ListingsSyncResult> {
  const result: ListingsSyncResult = {
    found: active.length,
    created: 0,
    updated: 0,
    ended: 0,
    skipped: 0,
  };

  for (const listing of active) {
    const data = {
      title: listing.title,
      price: listing.price,
      currency: listing.currency,
      quantity: listing.quantity,
      quantitySold: listing.quantitySold,
      status: "ACTIVE" as const,
      imageUrl: listing.imageUrl,
      listingUrl: listing.listingUrl,
      startTime: listing.startTime,
      endTime: listing.endTime,
    };

    // ebayListingId is unique across the whole table, so an upsert keyed on it
    // alone could rewrite a row belonging to someone else. Check the owner.
    const existing = await prisma.listing.findUnique({
      where: { ebayListingId: listing.itemId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      await prisma.listing.create({
        data: { ebayListingId: listing.itemId, userId, ...data },
      });
      result.created++;
    } else if (existing.userId === userId) {
      await prisma.listing.update({ where: { id: existing.id }, data });
      result.updated++;
    } else {
      result.skipped++;
    }
  }

  const stillActive = new Set(active.map((l) => l.itemId));
  const gone = (
    await prisma.listing.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, ebayListingId: true },
    })
  ).filter((l) => EBAY_ITEM_ID.test(l.ebayListingId) && !stillActive.has(l.ebayListingId));

  if (gone.length) {
    const { count } = await prisma.listing.updateMany({
      where: { id: { in: gone.map((l) => l.id) } },
      data: { status: "ENDED" },
    });
    result.ended = count;
  }

  return result;
}
