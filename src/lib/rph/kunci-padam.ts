import { connection } from "next/server";
import { supabaseRuntimeConfig } from "@/lib/runtime-env";

export async function kunciServisSupabase() {
  await connection();
  for (let cubaan = 0; cubaan < 8; cubaan += 1) {
    const cfg = supabaseRuntimeConfig();
    if (cfg.url && cfg.service && cfg.key) return { url: cfg.url, key: cfg.key };
    await new Promise((selesai) => setTimeout(selesai, 80 * (cubaan + 1)));
    await connection();
  }
  const cfg = supabaseRuntimeConfig();
  return { url: cfg.url, key: cfg.service ? cfg.key : "" };
}
