export const HARI_LIST = ["ISNIN", "SELASA", "RABU", "KHAMIS", "JUMAAT"] as const;

export type Hari = (typeof HARI_LIST)[number];

export type SesiPdp = {
  id?: string;
  kelas: string;
  tingkatan: string;
  hari: string;
  masa: string;
  masa_mula: string;
  masa_tamat: string;
  mata_pelajaran: string;
};

export type JadualWaktu = {
  id: string;
  nama_fail: string | null;
  created_at: string;
  sesi: SesiPdp[];
};
