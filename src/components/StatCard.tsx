// src/components/StatCard.tsx
import Link from "next/link";
import styles from "./StatCard.module.css";

type Props = {
  label: string;
  value: string;
  icon: string;
  accent: "blue" | "green" | "purple" | "yellow" | "red";
  href?: string;
};

const ACCENT_COLORS = {
  blue: "var(--accent)",
  green: "var(--success)",
  purple: "var(--accent-2)",
  yellow: "var(--warning)",
  red: "var(--danger)",
};

export function StatCard({ label, value, icon, accent, href }: Props) {
  const color = ACCENT_COLORS[accent];
  const inner = (
    <div className={styles.card} style={{ "--accent-color": color } as any}>
      <div className={styles.iconWrap}>
        <span className={styles.icon}>{icon}</span>
      </div>
      <div className={styles.body}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
      </div>
      <div className={styles.bar} />
    </div>
  );

  return href ? <Link href={href} className={styles.link}>{inner}</Link> : inner;
}
