import type { RphRekod, RphStandard } from "./types";
import type { SesiPdp } from "@/lib/jadual/types";

export type BorangRphNilai = {
  id?: string;
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
  refleksi_berjaya: "" | "ya" | "tidak";
  refleksi_catatan: string;
};

export const NILAI_ASAL = "PEMIKIR";

export function borangKosong(sesi?: SesiPdp | null): BorangRphNilai {
  const hari = sesi?.hari ?? "ISNIN";
  return {
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
    refleksi_berjaya: "",
    refleksi_catatan: "",
  };
}

export function dariRekod(rekod: RphRekod): BorangRphNilai {
  return {
    id: rekod.id,
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
    standard_pembelajaran: rekod.standard_pembelajaran,
    objektif: rekod.objektif.length ? rekod.objektif : ["", ""],
    bbm: rekod.bbm ?? "",
    nilai: rekod.nilai ?? NILAI_ASAL,
    aktiviti: rekod.aktiviti.length ? rekod.aktiviti : ["", "", "", "", "", ""],
    refleksi_peratus: rekod.refleksi_peratus != null ? String(rekod.refleksi_peratus) : "",
    refleksi_berjaya: rekod.refleksi_berjaya == null ? "" : rekod.refleksi_berjaya ? "ya" : "tidak",
    refleksi_catatan: rekod.refleksi_catatan ?? "",
  };
}

export function muatanSimpan(borang: BorangRphNilai) {
  const teksPeratus = String(borang.refleksi_peratus ?? "").replace(/%/g, "").trim();
  const peratus = teksPeratus === "" ? Number.NaN : Number(teksPeratus);
  const ditanda = borang.refleksi_berjaya === "ya" || borang.refleksi_berjaya === "tidak";
  return {
    ...borang,
    refleksi_peratus: Number.isFinite(peratus) ? peratus : null,
    refleksi_berjaya: ditanda ? borang.refleksi_berjaya === "ya" : null,
    refleksi_ditanda: ditanda,
    refleksi_catatan: borang.refleksi_catatan,
    nilai: borang.nilai,
  };
}
