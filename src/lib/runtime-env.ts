import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { env } from "node:process";

type EnvMap = Record<string, string>;

function parseEnvFile(filePath: string): EnvMap {
  if (!existsSync(filePath)) return {};
  const envFile: EnvMap = {};
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
    envFile[key] = value;
  }
  return envFile;
}

function fileEnv(): EnvMap {
  const cwd = process.cwd();
  const files = [
    join(cwd, ".env.local"),
    join(cwd, ".env"),
    join(cwd, "e-rph", ".env.local"),
    join(dirname(process.cwd()), "e-rph", ".env.local"),
    "/Users/suhaili/e-rph/.env.local",
  ];
  return files.reduce<EnvMap>((all, file) => ({ ...all, ...parseEnvFile(file) }), {});
}

function semuaEnv(): Record<string, string> {
  const keluar: Record<string, string> = {};
  const bag = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (bag) {
    for (const nama of Object.keys(bag)) {
      const nilai = bag[nama];
      if (typeof nilai === "string" && nilai.trim()) keluar[nama] = nilai.trim();
    }
  }
  for (const [nama, nilai] of Object.entries(fileEnv())) {
    if (nilai.trim()) keluar[nama] = nilai.trim();
  }
  return keluar;
}

function readEnv(name: string) {
  return semuaEnv()[name] ?? "";
}

export function runtimeEnv(key: string) {
  const value = readEnv(key);
  if (value) env[key] = value;
  return value;
}

function jwtRole(key: string) {
  try {
    return String(
      JSON.parse(Buffer.from(key.split(".")[1] || "", "base64url").toString()).role ?? ""
    );
  } catch {
    return "";
  }
}

export function kunciSupabase() {
  // Rujukan process.env.NAMA wajib supaya Vercel memasukkan rahsia ke fungsi pelayan.
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    nilaiEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    nilaiEnv("SUPABASE_URL");
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    nilaiEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    nilaiEnv("SUPABASE_SECRET_KEY");
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    nilaiEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    nilaiEnv("SUPABASE_ANON_KEY") ||
    nilaiEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    nilaiEnv("SUPABASE_PUBLISHABLE_KEY");
  return { url, service, anon, key: service || anon };
}

export function supabaseRuntimeConfig() {
  const { url, service, key } = kunciSupabase();
  return {
    url,
    key,
    service: Boolean(service),
    role: jwtRole(key),
  };
}

function nilaiEnv(nama: string) {
  const peta = globalThis.process?.env;
  const nilai = peta?.[nama];
  return typeof nilai === "string" ? nilai.trim() : "";
}

export function geminiApiKey() {
  // Rujukan process.env.NAMA wajib supaya Next.js memasukkan kunci ke fungsi pelayan.
  // Nilai dibaca semula pada runtime kerana Vercel mungkin tidak mendedahkan rahsia semasa build.
  const calon = [
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    nilaiEnv("GOOGLE_GENERATIVE_AI_API_KEY"),
    nilaiEnv("GEMINI_API_KEY"),
    nilaiEnv("GOOGLE_API_KEY"),
  ];
  let key = calon.find((nilai) => nilai?.trim())?.trim() ?? "";
  if (!key) {
    const semua = semuaEnv();
    key =
      semua.GOOGLE_GENERATIVE_AI_API_KEY ||
      semua.GEMINI_API_KEY ||
      semua.GOOGLE_API_KEY ||
      "";
    if (!key) {
      for (const [nama, nilai] of Object.entries(semua)) {
        if (/GEMINI.*API.*KEY|GOOGLE.*GENERATIVE.*AI.*API.*KEY/i.test(nama)) {
          key = nilai;
          break;
        }
      }
    }
  }
  if (key) tetapkanGeminiEnv(key);
  return key;
}

export function tetapkanGeminiEnv(key: string) {
  if (!key || !globalThis.process?.env) return;
  globalThis.process.env.GOOGLE_GENERATIVE_AI_API_KEY = key;
  globalThis.process.env.GEMINI_API_KEY = key;
  env.GOOGLE_GENERATIVE_AI_API_KEY = key;
  env.GEMINI_API_KEY = key;
}
