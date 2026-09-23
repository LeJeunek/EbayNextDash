// src/app/api/inventory/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inventoryWhere, toCsv, withProfit } from "@/lib/inventory";

export const dynamic = "force-dynamic";

// GET /api/inventory/export — the current view as a CSV download
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  const items = await prisma.inventoryItem.findMany({
    where: inventoryWhere(session.user.id, searchParams),
    orderBy: [{ soldDate: "desc" }, { createdAt: "desc" }],
  });

  const year = searchParams.get("year");
  const suffix = year && year !== "ALL" ? year : "all";

  return new NextResponse(toCsv(items.map(withProfit)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${suffix}.csv"`,
    },
  });
}
