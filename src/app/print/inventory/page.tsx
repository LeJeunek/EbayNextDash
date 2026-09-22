// src/app/print/inventory/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inventoryWhere, summarize, withProfit } from "@/lib/inventory";
import { PrintControls } from "./PrintControls";
import styles from "./print.module.css";

export const dynamic = "force-dynamic";

const money = (n: number | null) => (n === null ? "—" : `$${n.toFixed(2)}`);

const shortDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "2-digit",
        timeZone: "UTC",
      })
    : "—";

export default async function InventoryPrintPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }

  const items = (
    await prisma.inventoryItem.findMany({
      where: inventoryWhere(session.user.id, params),
      orderBy: [{ soldDate: "asc" }, { createdAt: "asc" }],
    })
  ).map(withProfit);

  const summary = summarize(items);
  const year = params.get("year");
  const status = params.get("status");
  const search = params.get("q");

  const scope = [
    year && year !== "ALL" ? `Tax year ${year}` : "All years",
    status && status !== "ALL" ? `Status: ${status}` : null,
    search ? `Matching “${search}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const seller = session.user.ebayUsername || session.user.name || "Seller";

  return (
    <>
      <PrintControls />

      <div className={styles.sheet}>
        <header className={styles.head}>
          <div>
            <h1 className={styles.title}>Sales &amp; Cost Summary</h1>
            <p className={styles.scope}>{scope}</p>
          </div>
          <div className={styles.meta}>
            <div>
              <strong>Seller</strong> {seller}
            </div>
            <div>
              <strong>Generated</strong>{" "}
              {new Date().toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </header>

        <section className={styles.totals}>
          <Total label="Gross sales" value={money(summary.grossSales)} />
          <Total label="Cost of goods" value={money(summary.costOfGoods)} />
          <Total label="Packing" value={money(summary.packing)} />
          <Total label="Shipping" value={money(summary.shipping)} />
          <Total label="eBay fees" value={money(summary.fees)} />
          {summary.other > 0 && (
            <Total label="Other" value={money(summary.other)} />
          )}
          <Total label="Total expenses" value={money(summary.totalExpenses)} />
          <Total label="Net profit" value={money(summary.netProfit)} emphasis />
        </section>

        {items.length === 0 ? (
          <p className={styles.empty}>No items match this filter.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colNum}>#</th>
                <th>Sold</th>
                <th>Item</th>
                <th className={styles.right}>Cost</th>
                <th className={styles.right}>Sale</th>
                <th className={styles.right}>Pack</th>
                <th className={styles.right}>Ship</th>
                <th className={styles.right}>Fees</th>
                <th className={styles.right}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td className={styles.colNum}>{i + 1}</td>
                  <td className={styles.nowrap}>{shortDate(item.soldDate)}</td>
                  <td className={styles.item}>
                    {item.title}
                    {item.sku && (
                      <span className={styles.sku}> · {item.sku}</span>
                    )}
                  </td>
                  <td className={styles.right}>{money(item.originalCost)}</td>
                  <td className={styles.right}>{money(item.sellPrice)}</td>
                  <td className={styles.right}>{money(item.packingCost)}</td>
                  <td className={styles.right}>{money(item.shippingCost)}</td>
                  <td className={styles.right}>{money(item.ebayFee)}</td>
                  <td className={`${styles.right} ${styles.profit}`}>
                    {money(item.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>
                  Totals — {summary.soldCount} sold
                  {summary.unsoldCount > 0 &&
                    `, ${summary.unsoldCount} unsold (${money(summary.unsoldCost)} invested)`}
                </td>
                <td className={styles.right}>{money(summary.costOfGoods)}</td>
                <td className={styles.right}>{money(summary.grossSales)}</td>
                <td className={styles.right}>{money(summary.packing)}</td>
                <td className={styles.right}>{money(summary.shipping)}</td>
                <td className={styles.right}>{money(summary.fees)}</td>
                <td className={`${styles.right} ${styles.profit}`}>
                  {money(summary.netProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        <footer className={styles.foot}>
          Profit = sale price − (original cost + packing + shipping + eBay fees
          + other costs). Figures come from records kept by the seller and are a
          working summary, not a filed tax document.
        </footer>
      </div>
    </>
  );
}

function Total({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`${styles.total} ${emphasis ? styles.emphasis : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
