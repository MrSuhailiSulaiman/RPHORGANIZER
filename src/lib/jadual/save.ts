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

export async function senaraiSesi(penggunaId: string): Promise<SesiPdp[]> {
  if (!isSupabaseConfigured() || !penggunaId) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sesi_pdp")
    .select("id, kelas, tingkatan, hari, masa, masa_mula, masa_tamat, mata_pelajaran, susunan")
    .eq("pengguna_id", penggunaId)
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

export async function getSesi(id: string, penggunaId: string): Promise<SesiPdp | null> {
  if (!isSupabaseConfigured() || !penggunaId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sesi_pdp")
    .select("id, kelas, tingkatan, hari, masa, masa_mula, masa_tamat, mata_pelajaran")
    .eq("id", id)
    .eq("pengguna_id", penggunaId)
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

export async function getJadualTerkini(penggunaId: string): Promise<JadualWaktu | null> {
  if (!isSupabaseConfigured() || !penggunaId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("jadual_waktu")
    .select("id, nama_fail, created_at")
    .eq("pengguna_id", penggunaId)
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
    sesi: await senaraiSesi(penggunaId),
  };
}

export async function simpanJadual(namaFail: string, sesi: SesiPdp[], penggunaId: string) {
  if (!penggunaId) throw new Error("Sila log masuk.");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("simpan_jadual_waktu", {
    payload: {
      nama_fail: namaFail,
      pengguna_id: penggunaId,
      sesi,
    },
  });
  if (!error) return { id: data as string };

  if (!/DELETE requires a WHERE clause|pengguna_id diperlukan|column .*pengguna_id/i.test(error.message ?? "")) {
    throw skemaRalat(error);
  }

  const { data: sediaAda, error: bacaRalat } = await supabase
    .from("jadual_waktu")
    .select("id")
    .eq("pengguna_id", penggunaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bacaRalat) throw skemaRalat(bacaRalat);

  let jadualId = sediaAda?.id as string | undefined;
  if (jadualId) {
    const { error: padamSesi } = await supabase.from("sesi_pdp").delete().eq("jadual_id", jadualId);
    if (padamSesi) throw skemaRalat(padamSesi);
    const { error: kemaskini } = await supabase
      .from("jadual_waktu")
      .update({ nama_fail: namaFail, pengguna_id: penggunaId })
      .eq("id", jadualId);
    if (kemaskini) throw skemaRalat(kemaskini);
  } else {
    const { data: baru, error: cipta } = await supabase
      .from("jadual_waktu")
      .insert({ nama_fail: namaFail, pengguna_id: penggunaId })
      .select("id")
      .single();
    if (cipta) throw skemaRalat(cipta);
    jadualId = baru.id as string;
  }

  const { error: masukSesi } = await supabase.from("sesi_pdp").insert(
    sesi.map((item, index) => ({
      jadual_id: jadualId,
      kelas: item.kelas,
      tingkatan: item.tingkatan || null,
      hari: item.hari,
      masa: item.masa,
      masa_mula: item.masa_mula || null,
      masa_tamat: item.masa_tamat || null,
      mata_pelajaran: item.mata_pelajaran,
      susunan: index,
      pengguna_id: penggunaId,
    }))
  );
  if (masukSesi) {
    if (/row-level security|permission denied|RLS/i.test(masukSesi.message ?? "")) {
      throw new Error(
        "Jadual tidak dapat disimpan. Jalankan fungsi simpan_jadual_waktu yang dikemas kini dalam supabase/schema.sql pada SQL Editor Supabase."
      );
    }
    throw skemaRalat(masukSesi);
  }
  return { id: jadualId };
}
