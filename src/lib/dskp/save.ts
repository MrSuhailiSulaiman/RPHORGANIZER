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
