// src/app/api/inventory/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { demoInventoryCsv } from "@/lib/demo/responses";
import { getViewer } from "@/lib/viewer";
import { prisma } from "@/lib/prisma";
import { inventoryWhere, toCsv, withProfit } from "@/lib/inventory";

export const dynamic = "force-dynamic";

// GET /api/inventory/export — the current view as a CSV download
export async function GET(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.kind === "demo") {
    const sp = new URL(req.url).searchParams;
    return csvResponse(demoInventoryCsv(sp), sp);
  }
  const userId = viewer.userId;

  const { searchParams } = new URL(req.url);

  const items = await prisma.inventoryItem.findMany({
    where: inventoryWhere(userId, searchParams),
    orderBy: [{ soldDate: "desc" }, { createdAt: "desc" }],
  });

  return csvResponse(toCsv(items.map(withProfit)), searchParams);
}

function csvResponse(csv: string, searchParams: URLSearchParams) {
  const year = searchParams.get("year");
  const suffix = year && year !== "ALL" ? year : "all";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${suffix}.csv"`,
    },
  });
}
