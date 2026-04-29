// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EbayApiClient, mapEbayOrder } from "@/lib/ebay";

// GET /api/orders - fetch all orders for the user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sync = searchParams.get("sync") === "true";
  const status = searchParams.get("status");
  const days = parseInt(searchParams.get("days") || "30");

  // Sync from eBay if requested
  if (sync && session.accessToken) {
    try {
      const client = new EbayApiClient(session.accessToken);
      const ebayOrders = await client.getRecentOrders(days);

      if (ebayOrders.orders?.length) {
        await Promise.all(
          ebayOrders.orders.map((ebayOrder: any) => {
            const data = mapEbayOrder(ebayOrder, session.user.id);
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
    }
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const orders = await prisma.order.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status: status as any } : {}),
    },
    orderBy: { saleDate: "desc" },
    include: { listing: { select: { title: true, imageUrl: true } } },
  });

  return NextResponse.json({ orders });
}
