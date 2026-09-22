"use client";
// src/app/dashboard/inventory/page.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./inventory.module.css";

type Item = {
  id: string;
  title: string;
  sku: string | null;
  category: string | null;
  condition: string | null;
  source: string | null;
  notes: string | null;
  purchaseDate: string | null;
  listedDate: string | null;
  soldDate: string | null;
  status: string;
  originalCost: number;
  sellPrice: number | null;
  packingCost: number;
  shippingCost: number;
  ebayFee: number;
  otherCost: number;
  totalCost: number;
  profit: number | null;
  margin: number | null;
  ebayOrderId: string | null;
};

type Summary = {
  itemCount: number;
  soldCount: number;
  unsoldCount: number;
  grossSales: number;
  costOfGoods: number;
  packing: number;
  shipping: number;
  fees: number;
  other: number;
  totalExpenses: number;
  netProfit: number;
  margin: number;
  unsoldCost: number;
};

const STATUSES = ["DRAFT", "LISTED", "SOLD", "RETURNED", "UNSOLD"];

const money = (n: number | null) =>
  n === null ? "—" : `$${n.toFixed(2)}`;

/** ISO timestamp → the yyyy-mm-dd a date input expects. */
const dateValue = (v: string | null) => (v ? v.slice(0, 10) : "");

const emptyDraft = {
  title: "",
  sku: "",
  category: "",
  source: "",
  purchaseDate: "",
  soldDate: "",
  status: "LISTED",
  originalCost: "",
  sellPrice: "",
  packingCost: "",
  shippingCost: "",
  ebayFee: "",
  otherCost: "",
  notes: "",
};

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [year, setYear] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (year !== "ALL") p.set("year", year);
    if (status !== "ALL") p.set("status", status);
    if (search.trim()) p.set("q", search.trim());
    return p.toString();
  }, [year, status, search]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/inventory?${query}`);
    if (!res.ok) {
      setMessage("Could not load inventory.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items || []);
    setSummary(data.summary || null);
    setYears(data.years || []);
    setLoading(false);
  }, [query]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  /** Save one edited cell, then replace that row with what the server returned. */
  const patch = async (id: string, field: string, value: string) => {
    const res = await fetch(`/api/inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || "Could not save that change.");
      load();
      return;
    }
    const { item } = await res.json();
    // Show the saved row straight away, then resync: totals move with every
    // money field, and a date or status edit can push the row out of the
    // filter that is currently on screen.
    setItems((prev) => prev.map((i) => (i.id === id ? item : i)));
    load();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("add");
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setBusy(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || "Could not add that item.");
      return;
    }
    setDraft(emptyDraft);
    setShowAdd(false);
    setMessage(null);
    load();
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    await fetch(`/api/inventory/${item.id}`, { method: "DELETE" });
    load();
  };

  const handleImportOrders = async () => {
    setBusy("orders");
    const res = await fetch("/api/inventory/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromOrders: true, days: 365 }),
    });
    const data = await res.json();
    setBusy(null);
    setMessage(
      res.ok
        ? `Imported ${data.imported} order(s).${data.skipped?.length ? ` ${data.skipped.join(" ")}` : ""}`
        : data.error || "Import failed."
    );
    load();
  };

  const handleImportCsv = async () => {
    setBusy("csv");
    const res = await fetch("/api/inventory/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setMessage(data.error || "Import failed.");
      return;
    }
    setMessage(
      `Imported ${data.imported} row(s).${data.skipped?.length ? ` Skipped: ${data.skipped.join("; ")}` : ""}`
    );
    setCsvText("");
    setShowImport(false);
    load();
  };

  const printHref = `/print/inventory?${query}`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Inventory &amp; Profit</h1>
          <p className={styles.sub}>
            Every item you bought to resell — cost in, price out, profit on the
            right. Click any cell to edit it.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.ghostBtn}
            onClick={handleImportOrders}
            disabled={busy === "orders"}
          >
            {busy === "orders" ? "Importing…" : "↓ From eBay orders"}
          </button>
          <button
            className={styles.ghostBtn}
            onClick={() => setShowImport((v) => !v)}
          >
            {showImport ? "✕ Cancel" : "⇪ Import CSV"}
          </button>
          <a className={styles.ghostBtn} href={`/api/inventory/export?${query}`}>
            ⇩ Export CSV
          </a>
          <a className={styles.printBtn} href={printHref} target="_blank" rel="noopener">
            🖨 Print / PDF
          </a>
          <button className={styles.createBtn} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "✕ Cancel" : "+ Add Item"}
          </button>
        </div>
      </header>

      {message && (
        <div className={styles.message}>
          <span>{message}</span>
          <button onClick={() => setMessage(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {summary && (
        <div className={styles.summaryGrid}>
          <SummaryTile label="Gross Sales" value={money(summary.grossSales)} />
          <SummaryTile label="Cost of Goods" value={money(summary.costOfGoods)} />
          <SummaryTile label="Packing" value={money(summary.packing)} />
          <SummaryTile label="Shipping" value={money(summary.shipping)} />
          <SummaryTile label="eBay Fees" value={money(summary.fees)} />
          <SummaryTile
            label="Net Profit"
            value={money(summary.netProfit)}
            tone={summary.netProfit >= 0 ? "good" : "bad"}
            hint={`${summary.margin.toFixed(1)}% margin · ${summary.soldCount} sold`}
          />
        </div>
      )}

      <div className={styles.toolbar}>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="ALL">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          className={styles.search}
          placeholder="Search title, SKU, category, source, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {summary && (
          <span className={styles.count}>
            {summary.itemCount} item{summary.itemCount === 1 ? "" : "s"}
            {summary.unsoldCount > 0 &&
              ` · ${money(summary.unsoldCost)} tied up in ${summary.unsoldCount} unsold`}
          </span>
        )}
      </div>

      {showImport && (
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Paste CSV</h2>
          <p className={styles.panelHint}>
            First row must be headers. Recognised: Title, SKU, Category,
            Condition, Source, Purchase Date, Sold Date, Status, Original Cost,
            Sell Price, Packing Cost, Shipping Cost, eBay Fees, Other Cost, Notes.
            Only Title is required.
          </p>
          <textarea
            rows={8}
            className={styles.csvBox}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"Title,Original Cost,Sell Price,Packing Cost,Sold Date\nVintage camera,25.00,89.99,3.50,2026-03-14"}
          />
          <button
            className={styles.submitBtn}
            onClick={handleImportCsv}
            disabled={busy === "csv" || !csvText.trim()}
          >
            {busy === "csv" ? "Importing…" : "Import rows"}
          </button>
        </div>
      )}

      {showAdd && (
        <form className={styles.panel} onSubmit={handleAdd}>
          <h2 className={styles.panelTitle}>Add Item</h2>
          <div className={styles.formGrid}>
            <Field label="Title *" full>
              <input
                required
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="What is it?"
              />
            </Field>
            <Field label="SKU">
              <input value={draft.sku} onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))} />
            </Field>
            <Field label="Category">
              <input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} />
            </Field>
            <Field label="Bought from">
              <input value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} placeholder="Estate sale, thrift…" />
            </Field>
            <Field label="Status">
              <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Purchase date">
              <input type="date" value={draft.purchaseDate} onChange={(e) => setDraft((d) => ({ ...d, purchaseDate: e.target.value }))} />
            </Field>
            <Field label="Sold date">
              <input type="date" value={draft.soldDate} onChange={(e) => setDraft((d) => ({ ...d, soldDate: e.target.value }))} />
            </Field>
            <Field label="Original cost ($)">
              <input type="number" step="0.01" min="0" value={draft.originalCost} onChange={(e) => setDraft((d) => ({ ...d, originalCost: e.target.value }))} placeholder="0.00" />
            </Field>
            <Field label="Sell price ($)">
              <input type="number" step="0.01" min="0" value={draft.sellPrice} onChange={(e) => setDraft((d) => ({ ...d, sellPrice: e.target.value }))} placeholder="leave blank if unsold" />
            </Field>
            <Field label="Packing cost ($)">
              <input type="number" step="0.01" min="0" value={draft.packingCost} onChange={(e) => setDraft((d) => ({ ...d, packingCost: e.target.value }))} placeholder="0.00" />
            </Field>
            <Field label="Shipping cost ($)">
              <input type="number" step="0.01" min="0" value={draft.shippingCost} onChange={(e) => setDraft((d) => ({ ...d, shippingCost: e.target.value }))} placeholder="0.00" />
            </Field>
            <Field label="eBay fees ($)">
              <input type="number" step="0.01" min="0" value={draft.ebayFee} onChange={(e) => setDraft((d) => ({ ...d, ebayFee: e.target.value }))} placeholder="0.00" />
            </Field>
            <Field label="Other cost ($)">
              <input type="number" step="0.01" min="0" value={draft.otherCost} onChange={(e) => setDraft((d) => ({ ...d, otherCost: e.target.value }))} placeholder="0.00" />
            </Field>
            <Field label="Notes" full>
              <input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
            </Field>
          </div>
          <button type="submit" className={styles.submitBtn} disabled={busy === "add"}>
            {busy === "add" ? "Adding…" : "Add to inventory"}
          </button>
        </form>
      )}

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <span>🧮</span>
          <p>
            Nothing here yet. Add an item by hand, paste a CSV, or pull your
            synced eBay orders in as a starting point.
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.stickyCol}>Item</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Bought</th>
                <th>Sold</th>
                <th>Status</th>
                <th className={styles.num}>Cost</th>
                <th className={styles.num}>Sell</th>
                <th className={styles.num}>Packing</th>
                <th className={styles.num}>Ship</th>
                <th className={styles.num}>Fees</th>
                <th className={styles.num}>Other</th>
                <th className={`${styles.num} ${styles.stickyProfit}`}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className={styles.stickyCol}>
                    <Cell value={item.title} onSave={(v) => patch(item.id, "title", v)} wide />
                  </td>
                  <td><Cell value={item.sku ?? ""} onSave={(v) => patch(item.id, "sku", v)} /></td>
                  <td><Cell value={item.category ?? ""} onSave={(v) => patch(item.id, "category", v)} /></td>
                  <td><Cell type="date" value={dateValue(item.purchaseDate)} onSave={(v) => patch(item.id, "purchaseDate", v)} /></td>
                  <td><Cell type="date" value={dateValue(item.soldDate)} onSave={(v) => patch(item.id, "soldDate", v)} /></td>
                  <td>
                    <select
                      className={`${styles.statusSelect} ${styles[item.status.toLowerCase()]}`}
                      value={item.status}
                      onChange={(e) => patch(item.id, "status", e.target.value)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className={styles.num}><Cell type="number" value={item.originalCost.toFixed(2)} onSave={(v) => patch(item.id, "originalCost", v)} /></td>
                  <td className={styles.num}><Cell type="number" value={item.sellPrice === null ? "" : item.sellPrice.toFixed(2)} onSave={(v) => patch(item.id, "sellPrice", v)} placeholder="—" /></td>
                  <td className={styles.num}><Cell type="number" value={item.packingCost.toFixed(2)} onSave={(v) => patch(item.id, "packingCost", v)} /></td>
                  <td className={styles.num}><Cell type="number" value={item.shippingCost.toFixed(2)} onSave={(v) => patch(item.id, "shippingCost", v)} /></td>
                  <td className={styles.num}><Cell type="number" value={item.ebayFee.toFixed(2)} onSave={(v) => patch(item.id, "ebayFee", v)} /></td>
                  <td className={styles.num}><Cell type="number" value={item.otherCost.toFixed(2)} onSave={(v) => patch(item.id, "otherCost", v)} /></td>
                  <td className={`${styles.num} ${styles.stickyProfit}`}>
                    <div className={styles.profitCell}>
                      <span
                        className={`${styles.profit} ${
                          item.profit === null ? "" : item.profit >= 0 ? styles.good : styles.bad
                        }`}
                        title={item.margin !== null ? `${item.margin.toFixed(1)}% margin` : undefined}
                      >
                        {money(item.profit)}
                      </span>
                      <button
                        className={styles.rowDelete}
                        onClick={() => handleDelete(item)}
                        aria-label={`Delete ${item.title}`}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {summary && (
              <tfoot>
                <tr>
                  <td className={styles.stickyCol}>Totals ({summary.soldCount} sold)</td>
                  <td colSpan={5} />
                  <td className={styles.num}>{money(summary.costOfGoods)}</td>
                  <td className={styles.num}>{money(summary.grossSales)}</td>
                  <td className={styles.num}>{money(summary.packing)}</td>
                  <td className={styles.num}>{money(summary.shipping)}</td>
                  <td className={styles.num}>{money(summary.fees)}</td>
                  <td className={styles.num}>{money(summary.other)}</td>
                  <td className={`${styles.num} ${styles.stickyProfit}`}>
                    <div className={styles.profitCell}>
                      <span className={`${styles.profit} ${summary.netProfit >= 0 ? styles.good : styles.bad}`}>
                        {money(summary.netProfit)}
                      </span>
                      <span className={styles.deleteSpacer} />
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className={`${styles.tile} ${tone ? styles[tone + "Tile"] : ""}`}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      {hint && <span className={styles.tileHint}>{hint}</span>}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={full ? styles.fieldFull : styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/**
 * A table cell that edits in place. Saves on blur or Enter, reverts on Escape,
 * and stays quiet when nothing actually changed.
 */
function Cell({
  value,
  onSave,
  type = "text",
  wide,
  placeholder,
}: {
  value: string;
  onSave: (value: string) => void;
  type?: "text" | "number" | "date";
  wide?: boolean;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);

  // Pick up server-side changes (a save elsewhere, a reload) while not focused.
  useEffect(() => setLocal(value), [value]);

  return (
    <input
      className={`${styles.cell} ${wide ? styles.cellWide : ""}`}
      type={type}
      step={type === "number" ? "0.01" : undefined}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onSave(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setLocal(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
