"use client";
// src/app/dashboard/orders/page.tsx
import { useEffect, useState } from "react";
import styles from "./orders.module.css";

type Order = {
  id: string;
  orderId: string;
  itemTitle: string;
  buyerUsername?: string;
  salePrice: number;
  shippingCost: number;
  ebayFee: number;
  profit: number;
  currency: string;
  status: string;
  paymentStatus?: string;
  shippingStatus?: string;
  trackingNumber?: string;
  saleDate: string;
  listing?: { title: string; imageUrl?: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "yellow", PAID: "blue", SHIPPED: "purple",
  DELIVERED: "green", CANCELLED: "red", REFUNDED: "red",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<Order | null>(null);

  const load = async (sync = false) => {
    if (sync) setSyncing(true);
    else setLoading(true);
    const res = await fetch(`/api/orders${sync ? "?sync=true" : ""}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
    setSyncing(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = orders.filter(o => {
    const matchSearch =
      o.orderId.toLowerCase().includes(search.toLowerCase()) ||
      o.itemTitle.toLowerCase().includes(search.toLowerCase()) ||
      (o.buyerUsername || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Orders</h1>
          <p className={styles.sub}>{orders.length} total orders</p>
        </div>
        <button className={styles.syncBtn} onClick={() => load(true)} disabled={syncing}>
          {syncing ? "Syncing…" : "↻ Sync from eBay"}
        </button>
      </header>

      <div className={styles.controls}>
        <input
          className={styles.search}
          placeholder="Search by order ID, item, or buyer…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className={styles.filter}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          {["PENDING","PAID","SHIPPED","DELIVERED","CANCELLED","REFUNDED"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <span>🧾</span>
          <p>No orders found. Sync from eBay to import your orders.</p>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Order ID</span>
            <span>Item</span>
            <span>Buyer</span>
            <span>Sale Price</span>
            <span>Profit</span>
            <span>Status</span>
            <span>Date</span>
          </div>
          {filtered.map(order => (
            <div
              key={order.id}
              className={styles.tableRow}
              onClick={() => setSelected(order)}
            >
              <span className={styles.orderId}>#{order.orderId}</span>
              <span className={styles.itemTitle}>{order.itemTitle}</span>
              <span className={styles.buyer}>{order.buyerUsername || "—"}</span>
              <span className={styles.price}>${order.salePrice.toFixed(2)}</span>
              <span className={`${styles.profit} ${order.profit >= 0 ? styles.pos : styles.neg}`}>
                ${order.profit.toFixed(2)}
              </span>
              <span>
                <span className={`${styles.badge} ${styles[STATUS_COLORS[order.status]]}`}>
                  {order.status}
                </span>
              </span>
              <span className={styles.date}>{new Date(order.saleDate).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Drawer */}
      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.drawer} onClick={e => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2>Order #{selected.orderId}</h2>
              <button onClick={() => setSelected(null)} className={styles.closeBtn}>✕</button>
            </div>
            <div className={styles.drawerBody}>
              <div className={styles.drawerSection}>
                <label>Item</label>
                <p>{selected.itemTitle}</p>
              </div>
              {selected.buyerUsername && (
                <div className={styles.drawerSection}>
                  <label>Buyer</label>
                  <p>{selected.buyerUsername}</p>
                </div>
              )}
              <div className={styles.drawerGrid}>
                <div className={styles.drawerSection}>
                  <label>Sale Price</label>
                  <p className={styles.drawerPrice}>${selected.salePrice.toFixed(2)}</p>
                </div>
                <div className={styles.drawerSection}>
                  <label>Shipping Cost</label>
                  <p>${selected.shippingCost.toFixed(2)}</p>
                </div>
                <div className={styles.drawerSection}>
                  <label>eBay Fee</label>
                  <p className={styles.neg}>-${selected.ebayFee.toFixed(2)}</p>
                </div>
                <div className={styles.drawerSection}>
                  <label>Net Profit</label>
                  <p className={`${selected.profit >= 0 ? styles.pos : styles.neg} ${styles.drawerPrice}`}>
                    ${selected.profit.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className={styles.drawerSection}>
                <label>Status</label>
                <span className={`${styles.badge} ${styles[STATUS_COLORS[selected.status]]}`}>
                  {selected.status}
                </span>
              </div>
              {selected.trackingNumber && (
                <div className={styles.drawerSection}>
                  <label>Tracking</label>
                  <p className={styles.mono}>{selected.trackingNumber}</p>
                </div>
              )}
              <div className={styles.drawerSection}>
                <label>Sale Date</label>
                <p>{new Date(selected.saleDate).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
