// src/lib/viewer.ts
//
// One answer to "who is looking at this page?", used by every route and
// server page instead of calling getServerSession directly:
//
//   { kind: "user", userId, user } — signed in with eBay
//   { kind: "demo", user }         — exploring the demo (see lib/demo/config)
//   null                           — anonymous
//
// A real session always wins over a leftover demo cookie. The demo viewer
// deliberately has no userId, so TypeScript stops any code from querying the
// database on a demo visitor's behalf until it has checked `kind`.
import { getServerSession, type Session } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { DEMO_COOKIE, DEMO_COOKIE_VALUE, isDemoEnabled } from "@/lib/demo/config";
import { DEMO_USER } from "@/lib/demo/fixtures";

export type ViewerUser = Partial<
  Pick<Session["user"], "name" | "email" | "image" | "ebayUsername">
>;

export type Viewer =
  | { kind: "user"; userId: string; user: ViewerUser }
  | { kind: "demo"; user: typeof DEMO_USER };

export async function getViewer(): Promise<Viewer | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return { kind: "user", userId: session.user.id, user: session.user };
  }

  if (isDemoEnabled() && cookies().get(DEMO_COOKIE)?.value === DEMO_COOKIE_VALUE) {
    return { kind: "demo", user: DEMO_USER };
  }

  return null;
}
