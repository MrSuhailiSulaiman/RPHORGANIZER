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
    join(cwd, "e-rph", ".env.local"),
    join(dirname(process.cwd()), "e-rph", ".env.local"),
    "/Users/suhaili/e-rph/.env.local",
  ];
  return files.reduce<EnvMap>((all, file) => ({ ...all, ...parseEnvFile(file) }), {});
}

function namedEnv(key: string) {
  const fromProcess = {
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  }[key];
  if (typeof fromProcess === "string" && fromProcess.trim()) return fromProcess.trim();
  const dynamic = process.env[key];
  if (typeof dynamic === "string" && dynamic.trim()) return dynamic.trim();
  return fileEnv()[key]?.trim() ?? "";
}

export function runtimeEnv(key: string) {
  const value = namedEnv(key);
  if (value && !process.env[key]?.trim()) process.env[key] = value;
  return value;
}

export function geminiApiKey() {
  return runtimeEnv("GOOGLE_GENERATIVE_AI_API_KEY");
}
