"use client";
// src/components/Sidebar.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import styles from "./Sidebar.module.css";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "⬛" },
  { href: "/dashboard/listings", label: "Listings", icon: "📦" },
  { href: "/dashboard/orders", label: "Orders", icon: "🧾" },
  { href: "/dashboard/sales", label: "Sales", icon: "📈" },
];

type User = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  ebayUsername?: string;
};

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="10" fill="var(--accent)" opacity="0.15" />
          <path d="M8 20L14 14L20 20L26 14L32 20" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 26L14 20L20 26L26 20L32 26" stroke="var(--accent-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={styles.logoText}>SellerHub</span>
      </div>

      <div className={styles.nav}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.active : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
              {active && <span className={styles.indicator} />}
            </Link>
          );
        })}
      </div>

      <div className={styles.bottom}>
        <div className={styles.userCard}>
          {user.image ? (
            <img src={user.image} alt="" className={styles.avatar} />
          ) : (
            <div className={styles.avatarPlaceholder}>
              {(user.ebayUsername || user.name || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.ebayUsername || user.name}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
        </div>
        <button className={styles.signOut} onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign Out
        </button>
      </div>
    </nav>
  );
}
