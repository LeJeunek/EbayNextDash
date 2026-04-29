"use client";
// src/app/dashboard/listings/page.tsx
import { useEffect, useState } from "react";
import styles from "./listings.module.css";

type Listing = {
  id: string;
  ebayListingId: string;
  title: string;
  price: number;
  quantity: number;
  quantitySold: number;
  status: string;
  imageUrl?: string;
  category?: string;
  createdAt: string;
  _count?: { orders: number };
};

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", price: "", quantity: "1",
    condition: "NEW", imageUrl: "", category: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async (sync = false) => {
    if (sync) setSyncing(true);
    else setLoading(true);
    const res = await fetch(`/api/listings${sync ? "?sync=true" : ""}`);
    const data = await res.json();
    setListings(data.listings || []);
    setLoading(false);
    setSyncing(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: parseFloat(form.price), quantity: parseInt(form.quantity) }),
    });
    setForm({ title: "", description: "", price: "", quantity: "1", condition: "NEW", imageUrl: "", category: "" });
    setShowForm(false);
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    await fetch(`/api/listings/${id}`, { method: "DELETE" });
    load();
  };

  const statusColor: Record<string, string> = {
    ACTIVE: "green", ENDED: "gray", SOLD: "blue", DRAFT: "yellow", SUSPENDED: "red",
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Listings</h1>
          <p className={styles.sub}>{listings.length} items in your store</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.syncBtn} onClick={() => load(true)} disabled={syncing}>
            {syncing ? "Syncing…" : "↻ Sync from eBay"}
          </button>
          <button className={styles.createBtn} onClick={() => setShowForm(!showForm)}>
            {showForm ? "✕ Cancel" : "+ New Listing"}
          </button>
        </div>
      </header>

      {showForm && (
        <form className={styles.form} onSubmit={handleCreate}>
          <h2 className={styles.formTitle}>Create New Listing</h2>
          <div className={styles.formGrid}>
            <div className={styles.fieldFull}>
              <label>Title *</label>
              <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Item title" />
            </div>
            <div>
              <label>Price ($) *</label>
              <input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label>Quantity</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
            </div>
            <div>
              <label>Condition</label>
              <select value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}>
                <option value="NEW">New</option>
                <option value="LIKE_NEW">Like New</option>
                <option value="VERY_GOOD">Very Good</option>
                <option value="GOOD">Good</option>
                <option value="ACCEPTABLE">Acceptable</option>
                <option value="FOR_PARTS_OR_NOT_WORKING">For Parts</option>
              </select>
            </div>
            <div>
              <label>Category</label>
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Electronics" />
            </div>
            <div className={styles.fieldFull}>
              <label>Image URL</label>
              <input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div className={styles.fieldFull}>
              <label>Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Item description…" style={{ resize: "vertical" }} />
            </div>
          </div>
          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? "Creating…" : "Create Listing"}
          </button>
        </form>
      )}

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : listings.length === 0 ? (
        <div className={styles.empty}>
          <span>📦</span>
          <p>No listings yet. Create one above or sync from eBay.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {listings.map(listing => (
            <div key={listing.id} className={styles.card}>
              {listing.imageUrl ? (
                <img src={listing.imageUrl} alt={listing.title} className={styles.cardImg} />
              ) : (
                <div className={styles.cardImgPlaceholder}>📦</div>
              )}
              <div className={styles.cardBody}>
                <div className={styles.cardTop}>
                  <span className={`${styles.badge} ${styles[statusColor[listing.status]]}`}>
                    {listing.status}
                  </span>
                  {listing.category && <span className={styles.category}>{listing.category}</span>}
                </div>
                <h3 className={styles.cardTitle}>{listing.title}</h3>
                <div className={styles.cardMeta}>
                  <span className={styles.price}>${listing.price.toFixed(2)}</span>
                  <span className={styles.qty}>Qty: {listing.quantity}</span>
                  <span className={styles.sold}>Sold: {listing.quantitySold}</span>
                </div>
                <div className={styles.cardId}>ID: {listing.ebayListingId}</div>
              </div>
              <div className={styles.cardActions}>
                <button className={styles.deleteBtn} onClick={() => handleDelete(listing.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
