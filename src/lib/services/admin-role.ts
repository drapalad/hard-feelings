import type { SupabaseClient } from "@supabase/supabase-js";

export async function isAdminUser(client: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (error || data === null || typeof data !== "object" || !("role" in data)) {
      return false;
    }
    return data.role === "admin";
  } catch {
    return false;
  }
}
