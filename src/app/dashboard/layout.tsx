// src/app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { Sidebar } from "@/components/Sidebar";
import { DemoBanner } from "@/components/DemoBanner";
import styles from "./dashboard.module.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const demo = viewer.kind === "demo";

  return (
    <div className={styles.layout}>
      <Sidebar user={viewer.user} demo={demo} />
      <main className={styles.main}>
        {demo && <DemoBanner />}
        {children}
      </main>
    </div>
  );
}
