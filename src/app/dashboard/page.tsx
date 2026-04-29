// src/app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, subDays } from "date-fns";
import { StatCard } from "@/components/StatCard";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const since30 = startOfDay(subDays(new Date(), 29));

  const [
    activeListings,
    totalOrders,
    recentOrders,
    salesData,
  ] = await Promise.all([
    prisma.listing.count({ where: { userId, status: "ACTIVE" } }),
    prisma.order.count({ where: { userId } }),
    prisma.order.findMany({
      where: { userId, saleDate: { gte: since30 }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      select: { salePrice: true, profit: true },
    }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { saleDate: "desc" },
      take: 5,
      select: { orderId: true, itemTitle: true, salePrice: true, status: true, saleDate: true },
    }),
  ]);

  const revenue30 = recentOrders.reduce((s, o) => s + o.salePrice, 0);
  const profit30 = recentOrders.reduce((s, o) => s + o.profit, 0);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>
            Welcome back, <em>{session!.user.ebayUsername || session!.user.name?.split(" ")[0]}</em>
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
          accent="green"
          href="/dashboard/sales"
        />
        <StatCard
          label="30-Day Profit"
          value={`$${profit30.toFixed(2)}`}
          icon="📈"
          accent="yellow"
          href="/dashboard/sales"
        />
      </div>

      <section className={styles.recent}>
        <h2 className={styles.sectionTitle}>Recent Orders</h2>
        {salesData.length === 0 ? (
          <div className={styles.empty}>No orders yet. Sync your eBay account to import orders.</div>
        ) : (
          <div className={styles.orderList}>
            {salesData.map((order) => (
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
