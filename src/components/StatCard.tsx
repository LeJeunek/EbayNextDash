// src/components/StatCard.tsx
import type { CSSProperties } from "react";
import Link from "next/link";
import styles from "./StatCard.module.css";

type Props = {
  label: string;
  value: string;
  icon: string;
  accent: "blue" | "green" | "purple" | "yellow" | "red";
  href?: string;
};

// Cards stay neutral. Only a value that carries meaning gets color:
// "green" = gain/profit, "red" = loss. Other accents render neutral and are
// kept only so existing call sites still type-check.
const VALUE_COLORS: Partial<Record<Props["accent"], string>> = {
  green: "var(--success)",
  red: "var(--danger)",
};

export function StatCard({ label, value, icon, accent, href }: Props) {
  const color = VALUE_COLORS[accent];
  const inner = (
    <div className={styles.card} style={color ? ({ "--value-color": color } as CSSProperties) : undefined}>
      <div className={styles.iconWrap}>
        <span className={styles.icon}>{icon}</span>
      </div>
      <div className={styles.body}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
      </div>
    </div>
  );

  return href ? <Link href={href} className={styles.link}>{inner}</Link> : inner;
}
