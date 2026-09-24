import { kunciSupabase } from "@/lib/runtime-env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function supabaseUrl() {
  return kunciSupabase().url;
}

function supabaseServiceRoleKey() {
  return kunciSupabase().service;
}

function supabaseKey() {
  return kunciSupabase().key;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseKey());
}

export function createAdminClient(): SupabaseClient {
  const url = supabaseUrl();
  const key = supabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      "Kunci servis Supabase tidak dimuatkan. Semak SUPABASE_SERVICE_ROLE_KEY pada Vercel, kemudian deploy semula."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${key}` } },
  });
}
