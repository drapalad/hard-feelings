import type { User } from "@supabase/supabase-js";

export interface AuthUserClient {
  auth: {
    getUser: () => Promise<{ data: { user: User | null }; error: { code?: string; message?: string } | null }>;
    signOut: (options?: { scope?: "global" | "local" | "others" }) => Promise<unknown>;
  };
}

export async function resolveAuthUser(client: AuthUserClient): Promise<User | null> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error) {
      if (isStaleRefreshToken(error)) {
        await clearLocalSession(client);
      }
      return null;
    }
    return data.user ?? null;
  } catch (error) {
    if (isStaleRefreshToken(error)) {
      await clearLocalSession(client);
    }
    return null;
  }
}

export function isStaleRefreshToken(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return code === "refresh_token_not_found" || code === "refresh_token_already_used" || /refresh token/i.test(message);
}

async function clearLocalSession(client: AuthUserClient): Promise<void> {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Cookie-only session may already be unusable.
  }
}
