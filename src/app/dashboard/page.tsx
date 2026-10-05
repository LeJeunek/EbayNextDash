// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { loadOverview } from "@/lib/page-data";
import { StatCard } from "@/components/StatCard";
import styles from "./page.module.css";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  // Real users read from Postgres; demo visitors get the same figures from fixtures.
  const {
    activeListings,
    totalOrders,
    revenue30,
    profit30,
    recentOrders,
    trackedProfit,
    year,
  } = await loadOverview(viewer);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>
            Welcome back, <em>{viewer.user.ebayUsername || viewer.user.name?.split(" ")[0]}</em>
          </h1>
          <p className={styles.sub}>Here&apos;s what&apos;s happening with your store</p>
        </div>
      </header>

      <div className={styles.statsGrid}>
        <StatCard
          label="Active Listings"
          value={activeListings.toString()}
          icon="📦"
          accent="blue"
          href="/dashboard/listings"
        />
        <StatCard
          label="Total Orders"
          value={totalOrders.toString()}
          icon="🧾"
          accent="purple"
          href="/dashboard/orders"
        />
        <StatCard
          label="30-Day Revenue"
          value={`$${revenue30.toFixed(2)}`}
          icon="💰"
          accent="blue"
          href="/dashboard/sales"
        />
        <StatCard
          label="30-Day Profit"
          value={`$${profit30.toFixed(2)}`}
          icon="📈"
          accent={profit30 >= 0 ? "green" : "red"}
          href="/dashboard/sales"
        />
        <StatCard
          label={`${year} Tracked Profit`}
          value={`$${trackedProfit.toFixed(2)}`}
          icon="🧮"
          accent={trackedProfit >= 0 ? "green" : "red"}
          href="/dashboard/inventory"
        />
      </div>

      <section className={styles.recent}>
        <h2 className={styles.sectionTitle}>Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <div className={styles.empty}>No orders yet. Sync your eBay account to import orders.</div>
        ) : (
          <div className={styles.orderList}>
            {recentOrders.map((order) => (
              <div key={order.orderId} className={styles.orderRow}>
                <div className={styles.orderInfo}>
                  <span className={styles.orderTitle}>{order.itemTitle}</span>
                  <span className={styles.orderId}>#{order.orderId}</span>
                </div>
                <div className={styles.orderMeta}>
                  <span className={`${styles.badge} ${styles[order.status.toLowerCase()]}`}>
                    {order.status}
                  </span>
                  <span className={styles.orderPrice}>${order.salePrice.toFixed(2)}</span>
                  <span className={styles.orderDate}>
                    {new Date(order.saleDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
