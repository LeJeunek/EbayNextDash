"use client";
// src/app/dashboard/sales/page.tsx
import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import styles from "./sales.module.css";

type ChartDay = {
  date: string;
  label: string;
  revenue: number;
  profit: number;
  orders: number;
};

type Summary = {
  totalRevenue: number;
  totalProfit: number;
  totalFees: number;
  totalShipping: number;
  totalOrders: number;
  avgOrderValue: number;
  profitMargin: number;
};

const RANGES = [7, 14, 30, 90];

export default function SalesPage() {
  const [days, setDays] = useState(30);
  const [chartData, setChartData] = useState<ChartDay[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"area" | "bar">("area");

  const load = async (d: number) => {
    setLoading(true);
    const res = await fetch(`/api/sales?days=${d}`);
    const data = await res.json();
    setChartData(data.chartData || []);
    setSummary(data.summary || null);
    setLoading(false);
  };

  useEffect(() => { load(days); }, [days]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: ${p.value.toFixed(2)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Sales Analytics</h1>
          <p className={styles.sub}>Profit & revenue breakdown</p>
        </div>
        <div className={styles.rangeSelector}>
          {RANGES.map(d => (
            <button
              key={d}
              className={`${styles.rangeBtn} ${days === d ? styles.active : ""}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </header>

      {summary && (
        <div className={styles.statsGrid}>
          <StatBox label="Total Revenue" value={`$${summary.totalRevenue.toFixed(2)}`} accent="blue" />
          <StatBox label="Total Profit" value={`$${summary.totalProfit.toFixed(2)}`} accent="green" />
          <StatBox label="Profit Margin" value={`${summary.profitMargin}%`} accent="purple" />
          <StatBox label="eBay Fees" value={`$${summary.totalFees.toFixed(2)}`} accent="red" />
          <StatBox label="Orders" value={summary.totalOrders.toString()} accent="yellow" />
          <StatBox label="Avg Order Value" value={`$${summary.avgOrderValue.toFixed(2)}`} accent="blue" />
        </div>
      )}

      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <h2 className={styles.chartTitle}>Revenue & Profit — Last {days} Days</h2>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === "area" ? styles.activeView : ""}`} onClick={() => setView("area")}>Area</button>
            <button className={`${styles.viewBtn} ${view === "bar" ? styles.activeView : ""}`} onClick={() => setView("bar")}>Bar</button>
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : chartData.length === 0 ? (
          <div className={styles.empty}>
            <span>📊</span>
            <p>No sales data for this period. Sync your orders from eBay.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            {view === "area" ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f8ef7" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#4f8ef7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--text-2)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-2)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-2)" }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#4f8ef7" strokeWidth={2} fill="url(#revenue)" />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#34d399" strokeWidth={2} fill="url(#profit)" />
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--text-2)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-2)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-2)" }} />
                <Bar dataKey="revenue" name="Revenue" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  const colors: Record<string, string> = {
    blue: "var(--accent)", green: "var(--success)", purple: "var(--accent-2)",
    red: "var(--danger)", yellow: "var(--warning)",
  };
  return (
    <div className={styles.statBox} style={{ borderColor: colors[accent] + "33" }}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue} style={{ color: colors[accent] }}>{value}</p>
    </div>
  );
}
