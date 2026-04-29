// src/types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      ebayUsername?: string;
      ebayUserId?: string;
    };
  }

  interface User {
    ebayUserId?: string | null;
    ebayUsername?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    ebayUsername?: string;
    ebayUserId?: string;
  }
}
