import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { susunSesi } from "./parse";
import type { JadualWaktu, SesiPdp } from "./types";

function tableMissing(error: { message?: string }) {
  return /could not find the table|schema cache|does not exist/i.test(error.message ?? "");
}

function skemaRalat(error: { message?: string }) {
  if (tableMissing(error) || /simpan_jadual_waktu/i.test(error.message ?? "")) {
    return new Error(
      "Jadual waktu belum wujud dalam Supabase. Jalankan keseluruhan fail supabase/schema.sql dalam SQL Editor."
    );
  }
  return new Error(error.message ?? "Ralat pangkalan data.");
}

export async function senaraiSesi(): Promise<SesiPdp[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sesi_pdp")
    .select("id, kelas, tingkatan, hari, masa, masa_mula, masa_tamat, mata_pelajaran, susunan")
    .order("susunan", { ascending: true });
  if (error) {
    if (tableMissing(error)) return [];
    throw skemaRalat(error);
  }
  return susunSesi(
    (data ?? []).map((row) => ({
      id: row.id,
      kelas: row.kelas,
      tingkatan: row.tingkatan ?? "",
      hari: row.hari,
      masa: row.masa,
      masa_mula: row.masa_mula ?? "",
      masa_tamat: row.masa_tamat ?? "",
      mata_pelajaran: row.mata_pelajaran,
    }))
  );
}

export async function getSesi(id: string): Promise<SesiPdp | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sesi_pdp")
    .select("id, kelas, tingkatan, hari, masa, masa_mula, masa_tamat, mata_pelajaran")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (tableMissing(error)) return null;
    throw skemaRalat(error);
  }
  if (!data) return null;
  return {
    id: data.id,
    kelas: data.kelas,
    tingkatan: data.tingkatan ?? "",
    hari: data.hari,
    masa: data.masa,
    masa_mula: data.masa_mula ?? "",
    masa_tamat: data.masa_tamat ?? "",
    mata_pelajaran: data.mata_pelajaran,
  };
}

export async function getJadualTerkini(): Promise<JadualWaktu | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("jadual_waktu")
    .select("id, nama_fail, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (tableMissing(error)) return null;
    throw skemaRalat(error);
  }
  if (!data) return null;
  return {
    id: data.id,
    nama_fail: data.nama_fail,
    created_at: data.created_at,
    sesi: await senaraiSesi(),
  };
}

export async function simpanJadual(namaFail: string, sesi: SesiPdp[]) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("simpan_jadual_waktu", {
    payload: {
      nama_fail: namaFail,
      sesi,
    },
  });
  if (error) throw skemaRalat(error);
  return { id: data as string };
}
