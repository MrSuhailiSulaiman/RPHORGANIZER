import { bacaStatusRefleksi, STATUS_REFLEKSI_ASAL, type RphRekod, type RphStandard } from "./types";
import type { SesiPdp } from "@/lib/jadual/types";

export type ModRph = "pdpc" | "peperiksaan" | "cuti" | "ulangkaji";

/** Penanda tersimpan supaya mod ulang kaji kekal selepas borang dibuka semula. */
export const PENANDA_ULANGKAJI = "ULANGKAJI";

export const OBJEKTIF_PEPERIKSAAN = [
  "MEMASTIKAN MURID BERSEDIA UNTUK MENDUDUKI PEPERIKSAAN",
  "MEMASTIKAN MURID TIDAK MENIRU ATAU TIDUR SEMASA MENDUDUKI PEPERIKSAAN",
];

export const AKTIVITI_CUTI_ASAL = ["SELAMAT BERCUTI", "CUTI SEMPENA : "];

export function standardSebenar(senarai: RphStandard[]) {
  return senarai.filter((item) => item.kod !== PENANDA_ULANGKAJI || item.pernyataan.trim());
}

export function adaUlangkaji(senarai: RphStandard[]) {
  return senarai.some((item) => item.kod === PENANDA_ULANGKAJI && !item.pernyataan.trim());
}

export function terapModRph(borang: BorangRphNilai, mod: Exclude<ModRph, "pdpc">): BorangRphNilai {
  if (mod === "ulangkaji") {
    return {
      ...borang,
      mod,
      standard_pembelajaran: standardSebenar(borang.standard_pembelajaran),
    };
  }
  if (mod === "cuti") {
    return {
      ...borang,
      mod,
      bidang_kod: "",
      bidang_nama: "CUTI",
      sk_kod: "",
      sk_tajuk: "",
      standard_pembelajaran: [],
      objektif: [],
      bbm: "",
      nilai: "",
      aktiviti: [...AKTIVITI_CUTI_ASAL],
    };
  }
  return {
    ...borang,
    mod,
    bidang_kod: "",
    bidang_nama: "UJIAN/PEPERIKSAAN",
    sk_kod: "",
    sk_tajuk: "",
    standard_pembelajaran: [],
    objektif: [...OBJEKTIF_PEPERIKSAAN],
    bbm: "",
    nilai: "",
  };
}

export async function muatAktivitiPeperiksaan(borang: BorangRphNilai) {
  const res = await fetch("/api/rph/generate-sesi", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skop: "peperiksaan",
      mata_pelajaran: borang.mata_pelajaran,
      tingkatan: borang.tingkatan,
      kelas: borang.kelas,
      hari: borang.hari,
      masa: borang.masa,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ralat?: string;
    aktiviti?: string[];
    sandaran?: boolean;
    sebab?: string;
  };
  if (!res.ok) throw new Error(json.ralat ?? "Gagal menjana aktiviti peperiksaan.");
  return json;
}

export async function muatUlangkaji(borang: BorangRphNilai) {
  const res = await fetch("/api/rph/generate-sesi", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skop: "ulangkaji",
      mata_pelajaran: borang.mata_pelajaran,
      tingkatan: borang.tingkatan,
      kelas: borang.kelas,
      hari: borang.hari,
      masa: borang.masa,
      bidang_nama: borang.bidang_nama,
      sk_kod: borang.sk_kod,
      sk_tajuk: borang.sk_tajuk,
      standard_pembelajaran: standardSebenar(borang.standard_pembelajaran),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ralat?: string;
    objektif?: string[];
    aktiviti?: string[];
    bbm?: string;
    sandaran?: boolean;
    sebab?: string;
  };
  if (!res.ok) throw new Error(json.ralat ?? "Gagal menjana ulang kaji.");
  return json;
}

export function modDaripadaKandungan(
  objektif: string[],
  aktiviti: string[],
  standard: RphStandard[] = []
): ModRph {
  const obj = objektif.map((item) => item.trim().toUpperCase());
  if (obj[0] === OBJEKTIF_PEPERIKSAAN[0] && obj[1] === OBJEKTIF_PEPERIKSAAN[1]) return "peperiksaan";
  const pertama = (aktiviti[0] ?? "").trim().toUpperCase();
  if (pertama === "SELAMAT BERCUTI") return "cuti";
  if (adaUlangkaji(standard)) return "ulangkaji";
  return "pdpc";
}

export type BorangRphNilai = {
  id?: string;
  mod: ModRph;
  sesi_id: string;
  tarikh: string;
  hari: string;
  masa: string;
  tingkatan: string;
  kelas: string;
  mata_pelajaran: string;
  bidang_kod: string;
  bidang_nama: string;
  sk_kod: string;
  sk_tajuk: string;
  standard_pembelajaran: RphStandard[];
  objektif: string[];
  bbm: string;
  nilai: string;
  aktiviti: string[];
  refleksi_peratus: string;
  refleksi_berjaya: string;
  refleksi_catatan: string;
};

export const NILAI_ASAL = "PEMIKIR";

export function borangKosong(sesi?: SesiPdp | null): BorangRphNilai {
  const hari = sesi?.hari ?? "ISNIN";
  return {
    mod: "pdpc",
    sesi_id: sesi?.id ?? "",
    tarikh: "",
    hari,
    masa: sesi?.masa ?? "",
    tingkatan: sesi?.tingkatan ?? "",
    kelas: sesi?.kelas ?? "",
    mata_pelajaran: sesi?.mata_pelajaran ?? "",
    bidang_kod: "",
    bidang_nama: "",
    sk_kod: "",
    sk_tajuk: "",
    standard_pembelajaran: [],
    objektif: ["", ""],
    bbm: "",
    nilai: NILAI_ASAL,
    aktiviti: ["", "", "", "", "", ""],
    refleksi_peratus: "",
    refleksi_berjaya: STATUS_REFLEKSI_ASAL,
    refleksi_catatan: "",
  };
}

export function dariRekod(rekod: RphRekod): BorangRphNilai {
  const mod = modDaripadaKandungan(rekod.objektif, rekod.aktiviti, rekod.standard_pembelajaran);
  const kosongkanBahan = mod === "peperiksaan" || mod === "cuti";
  return {
    id: rekod.id,
    mod,
    sesi_id: rekod.sesi_id ?? "",
    tarikh: rekod.tarikh ?? "",
    hari: rekod.hari ?? "ISNIN",
    masa: rekod.masa ?? "",
    tingkatan: rekod.tingkatan ?? "",
    kelas: rekod.kelas ?? "",
    mata_pelajaran: rekod.mata_pelajaran ?? "",
    bidang_kod: rekod.bidang_kod ?? "",
    bidang_nama: rekod.bidang_nama ?? "",
    sk_kod: rekod.sk_kod ?? "",
    sk_tajuk: rekod.sk_tajuk ?? "",
    standard_pembelajaran: standardSebenar(rekod.standard_pembelajaran),
    objektif: rekod.objektif.length ? rekod.objektif : ["", ""],
    bbm: kosongkanBahan ? "" : (rekod.bbm ?? ""),
    nilai: kosongkanBahan ? "" : (rekod.nilai ?? NILAI_ASAL),
    aktiviti: rekod.aktiviti.length ? rekod.aktiviti : ["", "", "", "", "", ""],
    refleksi_peratus: rekod.refleksi_peratus != null ? String(rekod.refleksi_peratus) : "",
    refleksi_berjaya: bacaStatusRefleksi(rekod.refleksi_berjaya),
    refleksi_catatan: rekod.refleksi_catatan ?? "",
  };
}

export function muatanSimpan(borang: BorangRphNilai) {
  const teksPeratus = String(borang.refleksi_peratus ?? "").replace(/%/g, "").trim();
  const peratus = teksPeratus === "" ? Number.NaN : Number(teksPeratus);
  const standard = standardSebenar(borang.standard_pembelajaran);
  return {
    ...borang,
    standard_pembelajaran:
      borang.mod === "ulangkaji" ? [...standard, { kod: PENANDA_ULANGKAJI, pernyataan: "" }] : standard,
    refleksi_peratus: Number.isFinite(peratus) ? peratus : null,
    refleksi_berjaya: bacaStatusRefleksi(borang.refleksi_berjaya),
    refleksi_catatan: borang.refleksi_catatan,
    nilai: borang.nilai,
  };
}
