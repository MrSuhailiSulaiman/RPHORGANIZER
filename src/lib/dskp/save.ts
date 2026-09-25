import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { DSKP_BUCKET, muatTurunDskp } from "./storage";
import type { DskpExtract } from "./types";

export function hashFail(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function simpanDskp(params: {
  extract: DskpExtract;
  namaFail: string;
  mataPelajaran: string;
  tingkatan: string;
  pdfBytes?: Uint8Array;
  storagePath?: string;
}) {
  const supabase = createAdminClient();
  let storagePath = params.storagePath?.trim() || "";
  let bytes = params.pdfBytes;
  const baruMuat = !storagePath;

  if (storagePath && !bytes) {
    bytes = await muatTurunDskp(storagePath);
  }
  if (!bytes) {
    throw new Error("Fail PDF diperlukan.");
  }

  const failHash = hashFail(bytes);

  if (!storagePath) {
    storagePath = `${crypto.randomUUID()}/${params.namaFail.replace(/[^\w.\- ()]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from(DSKP_BUCKET).upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadError) {
      throw new Error(`Gagal muat naik PDF: ${uploadError.message}`);
    }
  }

  const payload = {
    nama_fail: params.namaFail,
    mata_pelajaran: params.mataPelajaran,
    tingkatan: params.tingkatan,
    tahun_terbitan: params.extract.tahun_terbitan,
    storage_path: storagePath,
    fail_hash: failHash,
    kaedah_analisis: params.extract.kaedah_analisis,
    bidang: params.extract.bidang,
  };

  const { data, error } = await supabase.rpc("simpan_dskp", { payload });

  if (error) {
    if (baruMuat) {
      await supabase.storage.from(DSKP_BUCKET).remove([storagePath]);
    }
    throw new Error(`Gagal simpan ke pangkalan data: ${error.message}`);
  }

  return { id: data as string, failHash };
}

async function idMataPelajaran(nama: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("mata_pelajaran").select("id, nama");
  if (error) throw new Error(error.message);
  const sama = (data ?? []).find((row) => row.nama.trim().toLowerCase() === nama.toLowerCase());
  if (sama) return sama.id as string;
  const inserted = await supabase.from("mata_pelajaran").insert({ nama }).select("id").single();
  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data.id as string;
}

export async function kemaskiniDskp(params: {
  id: string;
  extract: DskpExtract;
  mataPelajaran: string;
  tingkatan: string;
}) {
  const supabase = createAdminClient();
  const { data: dokumen, error: ralatDokumen } = await supabase
    .from("dokumen_dskp")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (ralatDokumen) throw new Error(ralatDokumen.message);
  if (!dokumen) throw new Error("DSKP tidak dijumpai.");

  const adaIsi = params.extract.bidang.some(
    (bidang) =>
      bidang.kod.trim() ||
      bidang.nama.trim() ||
      bidang.standard_kandungan.some(
        (sk) => sk.kod.trim() || sk.tajuk.trim() || sk.standard_pembelajaran.some((sp) => sp.kod.trim() || sp.pernyataan.trim())
      )
  );
  if (!adaIsi) throw new Error("DSKP kosong. Isi sekurang-kurangnya satu bidang, SK, atau SP.");

  const mpId = await idMataPelajaran(params.mataPelajaran);
  const { data: lama, error: ralatLama } = await supabase
    .from("bidang_pembelajaran")
    .select("id")
    .eq("dskp_id", params.id);
  if (ralatLama) throw new Error(ralatLama.message);

  const baru: string[] = [];
  try {
    for (const [bidangIdx, bidang] of params.extract.bidang.entries()) {
      const { data: bidangBaru, error: ralatBidang } = await supabase
        .from("bidang_pembelajaran")
        .insert({
          dskp_id: params.id,
          kod: bidang.kod.trim(),
          nama: bidang.nama.trim() || "Tidak bernama",
          penerangan: bidang.penerangan?.trim() || null,
          jam: bidang.jam,
          susunan: bidangIdx,
        })
        .select("id")
        .single();
      if (ralatBidang) throw new Error(ralatBidang.message);
      baru.push(bidangBaru.id);

      for (const [skIdx, sk] of bidang.standard_kandungan.entries()) {
        const { data: skBaru, error: ralatSk } = await supabase
          .from("standard_kandungan")
          .insert({
            bidang_id: bidangBaru.id,
            kod: sk.kod.trim(),
            tajuk: sk.tajuk.trim() || "Tidak bertajuk",
            susunan: skIdx,
          })
          .select("id")
          .single();
        if (ralatSk) throw new Error(ralatSk.message);

        if (!sk.standard_pembelajaran.length) continue;
        const { error: ralatSp } = await supabase.from("standard_pembelajaran").insert(
          sk.standard_pembelajaran.map((sp, spIdx) => ({
            sk_id: skBaru.id,
            kod: sp.kod.trim(),
            pernyataan: sp.pernyataan.trim(),
            butiran: sp.butiran.map((item) => item.trim()).filter(Boolean),
            susunan: spIdx,
          }))
        );
        if (ralatSp) throw new Error(ralatSp.message);
      }
    }

    const idLama = (lama ?? []).map((row) => row.id as string);
    if (idLama.length) {
      const { error: ralatPadam } = await supabase.from("bidang_pembelajaran").delete().in("id", idLama);
      if (ralatPadam) throw new Error(ralatPadam.message);
    }

    const { error: ralatKemas } = await supabase
      .from("dokumen_dskp")
      .update({
        mata_pelajaran_id: mpId,
        mata_pelajaran: params.mataPelajaran,
        tingkatan: params.tingkatan,
        tahun_terbitan: params.extract.tahun_terbitan,
      })
      .eq("id", params.id);
    if (ralatKemas) throw new Error(ralatKemas.message);
  } catch (error) {
    if (baru.length) {
      await supabase.from("bidang_pembelajaran").delete().in("id", baru);
    }
    throw error;
  }
}
