// src/app/api/sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { demoSales } from "@/lib/demo/responses";
import { getViewer } from "@/lib/viewer";
import { prisma } from "@/lib/prisma";
import { buildSalesReport, parseDays, salesWindowStart } from "@/lib/sales-report";

export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = parseDays(new URL(req.url).searchParams.get("days"));
  if (viewer.kind === "demo") return NextResponse.json(demoSales(days));

  const now = new Date();
  const orders = await prisma.order.findMany({
    where: {
      userId: viewer.userId,
      saleDate: { gte: salesWindowStart(days, now) },
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
    select: {
      saleDate: true,
      salePrice: true,
      profit: true,
      ebayFee: true,
      shippingCost: true,
      status: true,
    },
    orderBy: { saleDate: "asc" },
  });

  return NextResponse.json(buildSalesReport(orders, days, now));
}
