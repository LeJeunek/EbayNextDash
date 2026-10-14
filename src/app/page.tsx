// src/app/page.tsx
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";

export default async function RootPage() {
  const viewer = await getViewer();
  redirect(viewer ? "/dashboard" : "/login");
}
