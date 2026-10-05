// src/components/DemoBanner.tsx
//
// Shown above every dashboard page while a visitor is in demo mode, so it is
// never ambiguous that the numbers are sample data and nothing reaches eBay.
// A plain <a> (not <Link>) so leaving the demo is a full request to the route
// handler that clears the cookie.
import styles from "./DemoBanner.module.css";

export function DemoBanner() {
  return (
    <div className={styles.banner} role="status">
      <span className={styles.tag}>Demo</span>
      <span className={styles.text}>
        You&apos;re viewing sample data. Nothing here talks to eBay, and edits aren&apos;t saved.
      </span>
      <a href="/demo/exit" className={styles.exit}>
        Exit demo
      </a>
    </div>
  );
}
