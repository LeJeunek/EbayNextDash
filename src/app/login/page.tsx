// src/app/login/page.tsx
//
// Server wrapper so the demo switch (DEMO_MODE) is read on the server and the
// "Explore the demo" link only appears when /demo will actually work.
import { isDemoEnabled } from "@/lib/demo/config";
import { LoginClient } from "./LoginClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginClient demoEnabled={isDemoEnabled()} />;
}
