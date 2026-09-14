export type RphStandard = {
  kod: string;
  pernyataan: string;
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
  refleksi_berjaya: boolean | null;
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
      }>;
    }>;
  }>;
};
