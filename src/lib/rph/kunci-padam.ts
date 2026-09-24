import { connection } from "next/server";
import { geminiApiKey, supabaseRuntimeConfig, tetapkanGeminiEnv } from "@/lib/runtime-env";

export async function kunciServisSupabase() {
  await connection();
  for (let cubaan = 0; cubaan < 8; cubaan += 1) {
    const cfg = supabaseRuntimeConfig();
    if (cfg.url && cfg.service && cfg.key) return { url: cfg.url, key: cfg.key };
    await new Promise((selesai) => setTimeout(selesai, 80 * (cubaan + 1)));
    await connection();
  }
  const cfg = supabaseRuntimeConfig();
  return { url: cfg.url, key: cfg.key };
}

async function kunciGeminiDariSupabase() {
  const cfg = await kunciServisSupabase();
  if (!cfg.url || !cfg.key) return "";
  try {
    const res = await fetch(`${cfg.url}/storage/v1/object/app-kunci/gemini-api-key.txt`, {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return "";
    const teks = (await res.text()).trim();
    return teks;
  } catch {
    return "";
  }
}

export async function kunciGemini() {
  await connection();
  const terus = geminiApiKey();
  if (terus) return terus;
  const simpanan = await kunciGeminiDariSupabase();
  if (simpanan) {
    tetapkanGeminiEnv(simpanan);
    return simpanan;
  }
  return geminiApiKey();
}
