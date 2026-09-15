import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
    join(cwd, ".env"),
    join(cwd, "e-rph", ".env.local"),
    join(dirname(process.cwd()), "e-rph", ".env.local"),
    "/Users/suhaili/e-rph/.env.local",
  ];
  return files.reduce<EnvMap>((all, file) => ({ ...all, ...parseEnvFile(file) }), {});
}

function readEnv(name: string) {
  const runtime = process.env[name];
  if (typeof runtime === "string" && runtime.trim()) return runtime.trim();
  return fileEnv()[name]?.trim() ?? "";
}

export function runtimeEnv(key: string) {
  const value = readEnv(key);
  if (value) process.env[key] = value;
  return value;
}

export function geminiApiKey() {
  const key =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    runtimeEnv("GOOGLE_GENERATIVE_AI_API_KEY") ||
    runtimeEnv("GEMINI_API_KEY") ||
    runtimeEnv("GOOGLE_API_KEY");
  if (key) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = key;
    process.env["GOOGLE_GENERATIVE_AI_API_KEY"] = key;
  }
  return key;
}
