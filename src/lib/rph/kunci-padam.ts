import { connection } from "next/server";

function namaEnv(...bahagian: string[]) {
  return bahagian.join("_");
}

function bacaRuntime(nama: string) {
  const proses = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const nilai = proses?.env?.[nama];
  return typeof nilai === "string" ? nilai.trim() : "";
}

export async function kunciServisSupabase() {
  await connection();
  const urlNama = [namaEnv("NEXT", "PUBLIC", "SUPABASE", "URL"), namaEnv("SUPABASE", "URL")];
  const kunciNama = namaEnv("SUPABASE", "SERVICE", "ROLE", "KEY");
  for (let cubaan = 0; cubaan < 8; cubaan += 1) {
    const url = bacaRuntime(urlNama[0]) || bacaRuntime(urlNama[1]);
    const key = bacaRuntime(kunciNama);
    if (url && key) return { url, key };
    await new Promise((selesai) => setTimeout(selesai, 80 * (cubaan + 1)));
    await connection();
  }
  return {
    url: bacaRuntime(urlNama[0]) || bacaRuntime(urlNama[1]),
    key: bacaRuntime(kunciNama),
  };
}
