import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { gabungBidangSama } from "./gabung";
import type { DokumenDskp, DokumenDskpWithTree } from "./types";

export type DokumenRingkas = DokumenDskp & {
  bil_bidang: number;
  bil_sk: number;
  bil_sp: number;
};

export async function senaraiDokumen(): Promise<DokumenRingkas[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("dokumen_dskp")
    .select(
      `
      *,
      bidang_pembelajaran (
        id,
        standard_kandungan (
          id,
          standard_pembelajaran (id)
        )
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const bidang = row.bidang_pembelajaran ?? [];
    const sk = bidang.flatMap((item: { standard_kandungan?: unknown[] }) => item.standard_kandungan ?? []);
    const sp = sk.flatMap((item: { standard_pembelajaran?: unknown[] }) => item.standard_pembelajaran ?? []);
    return {
      id: row.id,
      nama_fail: row.nama_fail,
      mata_pelajaran_id: row.mata_pelajaran_id ?? null,
      mata_pelajaran: row.mata_pelajaran,
      tingkatan: row.tingkatan,
      tahun_terbitan: row.tahun_terbitan,
      storage_path: row.storage_path,
      fail_hash: row.fail_hash,
      kaedah_analisis: row.kaedah_analisis,
      status: row.status,
      ralat: row.ralat,
      created_at: row.created_at,
      bil_bidang: bidang.length,
      bil_sk: sk.length,
      bil_sp: sp.length,
    };
  });
}

export async function getDokumen(id: string): Promise<DokumenDskpWithTree | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("dokumen_dskp")
    .select(
      `
      *,
      bidang_pembelajaran (
        id,
        kod,
        nama,
        penerangan,
        jam,
        susunan,
        standard_kandungan (
          id,
          kod,
          tajuk,
          susunan,
          standard_pembelajaran (
            id,
            kod,
            pernyataan,
            butiran,
            susunan
          )
        )
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const dokumen = data as DokumenDskpWithTree;
  dokumen.bidang_pembelajaran.sort((a, b) => a.susunan - b.susunan);
  dokumen.bidang_pembelajaran = gabungBidangSama(dokumen.bidang_pembelajaran);
  for (const bidang of dokumen.bidang_pembelajaran) {
    bidang.standard_kandungan.sort((a, b) => a.susunan - b.susunan);
    for (const sk of bidang.standard_kandungan) {
      sk.standard_pembelajaran.sort((a, b) => a.susunan - b.susunan);
    }
  }
  return dokumen;
}
