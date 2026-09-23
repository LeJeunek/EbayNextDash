"use client";
// src/components/Sidebar.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "./ThemeToggle";
import { ResoldMark } from "./ResoldMark";
import styles from "./Sidebar.module.css";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "⬛" },
  { href: "/dashboard/listings", label: "Listings", icon: "📦" },
  { href: "/dashboard/orders", label: "Orders", icon: "🧾" },
  { href: "/dashboard/inventory", label: "Inventory", icon: "🧮" },
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
        <ResoldMark size={28} />
        <span className={styles.logoText}>Resold</span>
      </div>

      <div className={styles.nav}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
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
        <div className={styles.bottomRow}>
          <button className={styles.signOut} onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign Out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
