import { runtimeEnv } from "@/lib/runtime-env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function supabaseUrl() {
  return runtimeEnv("SUPABASE_URL") || runtimeEnv("NEXT_PUBLIC_SUPABASE_URL");
}

function supabaseServiceRoleKey() {
  return runtimeEnv(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"));
}

function supabaseKey() {
  return (
    supabaseServiceRoleKey() ||
    runtimeEnv("SUPABASE_ANON_KEY") ||
    runtimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseKey());
}

export function createAdminClient(): SupabaseClient {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) {
    throw new Error("Supabase belum dikonfigurasi. Isi kunci projek pada Vercel atau .env.local.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${key}` } },
  });
}
