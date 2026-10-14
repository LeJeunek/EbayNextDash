// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { demoOrders } from "@/lib/demo/responses";
import { getViewer } from "@/lib/viewer";
import { parseDays } from "@/lib/sales-report";
import { prisma } from "@/lib/prisma";
import { EbayApiClient, mapEbayOrder } from "@/lib/ebay";
import { getEbayAccessToken } from "@/lib/ebay-token";

// GET /api/orders - fetch all orders for the user
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.kind === "demo") {
    const sp = new URL(req.url).searchParams;
    return NextResponse.json(demoOrders(sp, parseDays(sp.get("days"))));
  }
  const userId = viewer.userId;

  const { searchParams } = new URL(req.url);
  const sync = searchParams.get("sync") === "true";
  const status = searchParams.get("status");
  const days = parseDays(searchParams.get("days"));

  // Sync from eBay if requested. Failures used to go only to the server log,
  // so a broken sync looked identical to one that found nothing.
  let syncError: string | null = null;
  let synced: { found: number } | null = null;
  if (sync) {
    try {
      const client = new EbayApiClient(await getEbayAccessToken(userId));
      const ebayOrders = await client.getRecentOrders(days);
      synced = { found: ebayOrders.orders?.length ?? 0 };

      if (ebayOrders.orders?.length) {
        await Promise.all(
          ebayOrders.orders.map((ebayOrder: any) => {
            const data = mapEbayOrder(ebayOrder, userId);
            return prisma.order.upsert({
              where: { orderId: data.orderId },
              create: data,
              update: {
                status: data.status as any,
                paymentStatus: data.paymentStatus,
                shippingStatus: data.shippingStatus,
                profit: data.profit,
              },
            });
          })
        );
      }
    } catch (err) {
      console.error("eBay orders sync error:", err);
      syncError = err instanceof Error ? err.message : "eBay orders sync failed";
    }
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const orders = await prisma.order.findMany({
    where: {
      userId: userId,
      saleDate: { gte: sinceDate },
      ...(status ? { status: status as any } : {}),
    },
    orderBy: { saleDate: "desc" },
    include: { listing: { select: { title: true, imageUrl: true } } },
  });

  return NextResponse.json({
    orders,
    ...(syncError ? { syncError } : {}),
    ...(synced ? { synced } : {}),
  });
}
