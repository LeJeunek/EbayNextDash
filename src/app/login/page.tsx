"use client";
// src/app/login/page.tsx
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./login.module.css";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  const handleLogin = async () => {
    setLoading(true);
    await signIn("ebay", { callbackUrl: "/dashboard" });
  };

  if (status === "loading") {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Animated background grid */}
      <div className={styles.grid} aria-hidden />
      <div className={styles.glow1} aria-hidden />
      <div className={styles.glow2} aria-hidden />

      <main className={styles.card}>
        {/* eBay-inspired multicolor stripe */}
        <div className={styles.stripe} aria-hidden>
          <span style={{ background: "var(--ebay-blue)" }} />
          <span style={{ background: "var(--ebay-red)" }} />
          <span style={{ background: "var(--ebay-yellow)" }} />
          <span style={{ background: "var(--ebay-green)" }} />
        </div>

        <div className={styles.logo}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="var(--accent)" opacity="0.15" />
            <path d="M8 20L14 14L20 20L26 14L32 20" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 26L14 20L20 26L26 20L32 26" stroke="var(--accent-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.logoText}>SellerHub</span>
        </div>

        <h1 className={styles.headline}>
          Your eBay store,<br />
          <em>under control.</em>
        </h1>
        <p className={styles.sub}>
          Connect your eBay account to manage listings, track orders, and
          visualize your profits — all in one place.
        </p>

        <div className={styles.features}>
          {[
            { icon: "📦", text: "Manage active listings" },
            { icon: "🧾", text: "Track orders by ID" },
            { icon: "📈", text: "30-day profit analytics" },
          ].map((f) => (
            <div key={f.text} className={styles.feature}>
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        <button
          className={styles.loginBtn}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <span className={styles.btnSpinner} />
          ) : (
            <>
              <EbayIcon />
              Sign in with eBay
            </>
          )}
        </button>

        <p className={styles.legal}>
          By connecting, you authorize this app to read your eBay listings
          and orders via eBay's official API. We never sell your data.
        </p>
      </main>
    </div>
  );
}

function EbayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4.5 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Z" fill="#3665f3" />
      <path d="M8.5 7H12c2.76 0 5 2.24 5 5s-2.24 5-5 5H8.5" stroke="#e53238" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 7l4.5 5-4.5 5" stroke="#f5af02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
