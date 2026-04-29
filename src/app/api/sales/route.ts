// src/app/api/sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, subDays, format, eachDayOfInterval } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");

  const since = startOfDay(subDays(new Date(), days - 1));
  const today = new Date();

  // Fetch orders in range
  const orders = await prisma.order.findMany({
    where: {
      userId: session.user.id,
      saleDate: { gte: since },
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
    select: {
      saleDate: true,
      salePrice: true,
      profit: true,
      ebayFee: true,
      shippingCost: true,
    },
    orderBy: { saleDate: "asc" },
  });

  // Build daily buckets
  const allDays = eachDayOfInterval({ start: since, end: today });
  const dailyMap = new Map<string, { revenue: number; profit: number; orders: number }>();
  allDays.forEach((d) => {
    dailyMap.set(format(d, "yyyy-MM-dd"), { revenue: 0, profit: 0, orders: 0 });
  });

  orders.forEach((order) => {
    const key = format(new Date(order.saleDate), "yyyy-MM-dd");
    if (dailyMap.has(key)) {
      const entry = dailyMap.get(key)!;
      entry.revenue += order.salePrice;
      entry.profit += order.profit;
      entry.orders += 1;
    }
  });

  const chartData = Array.from(dailyMap.entries()).map(([date, values]) => ({
    date,
    label: format(new Date(date), "MMM d"),
    revenue: Math.round(values.revenue * 100) / 100,
    profit: Math.round(values.profit * 100) / 100,
    orders: values.orders,
  }));

  // Summary stats
  const totalRevenue = orders.reduce((s, o) => s + o.salePrice, 0);
  const totalProfit = orders.reduce((s, o) => s + o.profit, 0);
  const totalFees = orders.reduce((s, o) => s + o.ebayFee, 0);
  const totalShipping = orders.reduce((s, o) => s + o.shippingCost, 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return NextResponse.json({
    chartData,
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      totalShipping: Math.round(totalShipping * 100) / 100,
      totalOrders,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : 0,
    },
  });
}
