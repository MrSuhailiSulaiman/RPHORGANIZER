export const STATUS_REFLEKSI_ASAL = "belum";

/** Teks yang disimpan dalam lajur varchar `refleksi_berjaya`. */
export function bacaStatusRefleksi(value: unknown): string {
  if (value === true || value === "true" || value === "ya") return "berjaya";
  if (value === false || value === "false") return "tidak";
  const teks = typeof value === "string" ? value.trim() : "";
  if (!teks || teks.toLowerCase() === "null") return STATUS_REFLEKSI_ASAL;
  const kecil = teks.toLowerCase();
  if (kecil === "berjaya") return "berjaya";
  if (kecil === "tidak" || kecil === "tidak berjaya") return "tidak";
  if (kecil === "belum" || kecil === "belum dilaksanakan") return "belum";
  return teks;
}

export type RphStandard = {
  kod: string;
  pernyataan: string;
  butiran?: string[];
};

export type RphRekod = {
  id: string;
  sesi_id: string | null;
  tarikh: string | null;
  hari: string | null;
  masa: string | null;
  tingkatan: string | null;
  kelas: string | null;
  mata_pelajaran: string | null;
  bidang_kod: string | null;
  bidang_nama: string | null;
  sk_kod: string | null;
  sk_tajuk: string | null;
  standard_pembelajaran: RphStandard[];
  objektif: string[];
  bbm: string | null;
  nilai: string | null;
  aktiviti: string[];
  refleksi_peratus: number | null;
  refleksi_berjaya: string;
  refleksi_catatan: string | null;
  created_at: string;
  updated_at: string;
};

export type KurikulumPilihan = {
  dokumen_id: string;
  mata_pelajaran: string;
  tingkatan: string | null;
  bidang: Array<{
    kod: string;
    nama: string;
    standard_kandungan: Array<{
      kod: string;
      tajuk: string;
      standard_pembelajaran: Array<{
        kod: string;
        pernyataan: string;
        butiran?: string[];
      }>;
    }>;
  }>;
};
