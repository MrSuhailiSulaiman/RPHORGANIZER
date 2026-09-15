import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type EnvMap = Record<string, string>;

function parseEnvFile(filePath: string): EnvMap {
  if (!existsSync(filePath)) return {};
  const env: EnvMap = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function fileEnv(): EnvMap {
  const cwd = process.cwd();
  const files = [
    join(cwd, ".env.local"),
    join(cwd, "e-rph", ".env.local"),
    join(dirname(process.cwd()), "e-rph", ".env.local"),
    "/Users/suhaili/e-rph/.env.local",
  ];
  return files.reduce<EnvMap>((all, file) => ({ ...all, ...parseEnvFile(file) }), {});
}

function envValue(key: string) {
  const runtime = process.env[key];
  if (typeof runtime === "string" && runtime.trim()) return runtime.trim();
  return fileEnv()[key]?.trim() ?? "";
}

function supabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    envValue("SUPABASE_URL") ||
    envValue("NEXT_PUBLIC_SUPABASE_URL")
  );
}

function supabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || envValue("SUPABASE_SERVICE_ROLE_KEY");
}

function supabaseKey() {
  return (
    supabaseServiceRoleKey() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    envValue("SUPABASE_ANON_KEY") ||
    envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

export function jwtRole(key = supabaseKey()) {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString());
    return typeof payload.role === "string" ? payload.role : "";
  } catch {
    return "";
  }
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
