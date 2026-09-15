import { runtimeEnv } from "@/lib/runtime-env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function supabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    runtimeEnv("SUPABASE_URL") ||
    runtimeEnv("NEXT_PUBLIC_SUPABASE_URL")
  );
}

function supabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function supabaseKey() {
  return (
    supabaseServiceRoleKey() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
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
