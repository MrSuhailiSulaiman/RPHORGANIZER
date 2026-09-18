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

function readEnv(name: string) {
  const proses = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const runtime = proses?.env?.[name] ?? env[name];
  if (typeof runtime === "string" && runtime.trim()) return runtime.trim();
  return fileEnv()[name]?.trim() ?? "";
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

export function supabaseRuntimeConfig() {
  const urlNama = ["NEXT_PUBLIC", "SUPABASE", "URL"].join("_");
  const urlNama2 = ["SUPABASE", "URL"].join("_");
  const servisNama = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
  const anonNama = ["SUPABASE", "ANON", "KEY"].join("_");
  const anonNama2 = ["NEXT_PUBLIC", "SUPABASE", "ANON", "KEY"].join("_");
  const url = readEnv(urlNama2) || readEnv(urlNama);
  const service = readEnv(servisNama);
  const anon = readEnv(anonNama) || readEnv(anonNama2);
  const key = service || anon;
  return {
    url,
    key,
    service: Boolean(service),
    role: jwtRole(key),
  };
}

export function geminiApiKey() {
  const key =
    readEnv("GOOGLE_GENERATIVE_AI_API_KEY") ||
    readEnv("GEMINI_API_KEY") ||
    readEnv("GOOGLE_API_KEY");
  if (key) env.GOOGLE_GENERATIVE_AI_API_KEY = key;
  return key;
}
