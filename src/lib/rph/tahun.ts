import { HARI_LIST } from "@/lib/jadual/types";
import type { SesiPdp } from "@/lib/jadual/types";
import type { KurikulumPilihan, RphStandard } from "./types";

export const BIL_MINGGU_TAHUN = 40;

export type UnitKurikulum = {
  kunci: string;
  bidang_kod: string;
  bidang_nama: string;
  sk_kod: string;
  sk_tajuk: string;
  standard_pembelajaran: RphStandard[];
};

export type SlotTahun = {
  minggu: number;
  tarikh: string;
  sesi: SesiPdp;
  unit: UnitKurikulum | null;
  dokumen_id: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatTarikh(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseTarikh(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function isninPadaAtauSelepas(value: string) {
  const date = parseTarikh(value);
  const day = date.getDay();
  const delta = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  date.setDate(date.getDate() + delta);
  return formatTarikh(date);
}

export function tarikhMulaTahunAsal(rujukan = new Date()) {
  const year = rujukan.getMonth() >= 11 ? rujukan.getFullYear() + 1 : rujukan.getFullYear();
  return isninPadaAtauSelepas(`${year}-01-12`);
}

export function tarikhSlot(mulaIsnin: string, minggu: number, hari: string) {
  const rank = HARI_LIST.indexOf(hari as (typeof HARI_LIST)[number]);
  const date = parseTarikh(mulaIsnin);
  date.setDate(date.getDate() + (minggu - 1) * 7 + Math.max(0, rank));
  return formatTarikh(date);
}

export function mingguDari(tarikh: string, mulaIsnin: string) {
  const a = parseTarikh(mulaIsnin).getTime();
  const b = parseTarikh(tarikh).getTime();
  return Math.floor((b - a) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function kunciSesi(sesi: SesiPdp) {
  return `${sesi.mata_pelajaran}|${sesi.tingkatan}|${sesi.kelas}`.toLowerCase();
}

function nomborTingkatan(value: string) {
  const match = value.match(/[1-6]/);
  return match ? match[0] : "";
}

export function ratakanKurikulum(kurikulum: KurikulumPilihan): UnitKurikulum[] {
  const unit: UnitKurikulum[] = [];
  for (const bidang of kurikulum.bidang) {
    for (const sk of bidang.standard_kandungan) {
      if (!sk.standard_pembelajaran.length) continue;
      unit.push({
        kunci: `${kurikulum.mata_pelajaran}|${kurikulum.tingkatan ?? ""}|${sk.kod}`,
        bidang_kod: bidang.kod,
        bidang_nama: `${bidang.kod} ${bidang.nama}`.trim(),
        sk_kod: sk.kod,
        sk_tajuk: sk.tajuk,
        standard_pembelajaran: sk.standard_pembelajaran,
      });
    }
  }
  return unit;
}

export function padankanKurikulum(sesi: SesiPdp, senarai: KurikulumPilihan[]) {
  const tahap = nomborTingkatan(sesi.tingkatan) || nomborTingkatan(sesi.kelas);
  const mp = sesi.mata_pelajaran.toLowerCase();
  const calon = senarai.filter((item) => {
    const nama = (item.mata_pelajaran ?? "").toLowerCase();
    return nama.includes(mp) || mp.includes(nama);
  });
  return (
    calon.find((item) => {
      const nilai = nomborTingkatan(item.tingkatan ?? "");
      return !tahap || !nilai || nilai === tahap;
    }) ??
    calon[0] ??
    null
  );
}

export function susunSlotTahun(params: {
  sesi: SesiPdp[];
  kurikulum: KurikulumPilihan[];
  tarikhMula: string;
  bilMinggu?: number;
}): SlotTahun[] {
  const mula = isninPadaAtauSelepas(params.tarikhMula);
  const bilMinggu = params.bilMinggu ?? BIL_MINGGU_TAHUN;
  const mingguan = [...params.sesi].sort((a, b) => {
    const hari = HARI_LIST.indexOf(a.hari as (typeof HARI_LIST)[number]) - HARI_LIST.indexOf(b.hari as (typeof HARI_LIST)[number]);
    if (hari) return hari;
    return (a.masa_mula || a.masa).localeCompare(b.masa_mula || b.masa);
  });

  const unitMengikutKunci = new Map<string, UnitKurikulum[]>();
  const dokumenMengikutKunci = new Map<string, string>();
  const kursor = new Map<string, number>();
  const baki = new Map<string, number>();
  const kiraMingguan = new Map<string, number>();

  for (const sesi of mingguan) {
    const kunci = kunciSesi(sesi);
    kiraMingguan.set(kunci, (kiraMingguan.get(kunci) ?? 0) + 1);
    if (unitMengikutKunci.has(kunci)) continue;
    const kurikulum = padankanKurikulum(sesi, params.kurikulum);
    unitMengikutKunci.set(kunci, kurikulum ? ratakanKurikulum(kurikulum) : []);
    if (kurikulum) dokumenMengikutKunci.set(kunci, kurikulum.dokumen_id);
  }

  function unitSeterusnya(kunci: string) {
    const unitList = unitMengikutKunci.get(kunci) ?? [];
    if (!unitList.length) return null;
    const jumlahSlot = (kiraMingguan.get(kunci) ?? 1) * bilMinggu;
    const tempoh = Math.max(1, Math.floor(jumlahSlot / unitList.length));
    let indeks = kursor.get(kunci) ?? 0;
    let tinggal = baki.get(kunci);
    if (tinggal == null) tinggal = tempoh;
    const unit = unitList[Math.min(indeks, unitList.length - 1)];
    tinggal -= 1;
    if (tinggal <= 0 && indeks < unitList.length - 1) {
      kursor.set(kunci, indeks + 1);
      baki.set(kunci, tempoh);
    } else {
      kursor.set(kunci, indeks);
      baki.set(kunci, tinggal);
    }
    return unit;
  }

  const slots: SlotTahun[] = [];
  for (let minggu = 1; minggu <= bilMinggu; minggu += 1) {
    for (const sesi of mingguan) {
      slots.push({
        minggu,
        tarikh: tarikhSlot(mula, minggu, sesi.hari),
        sesi,
        unit: unitSeterusnya(kunciSesi(sesi)),
        dokumen_id: dokumenMengikutKunci.get(kunciSesi(sesi)) ?? null,
      });
    }
  }

  return slots;
}

export type SlotMingguRph = {
  id: string;
  tarikh: string | null;
  hari: string | null;
  masa: string | null;
};

export function bandingSesiRph(a: SlotMingguRph, b: SlotMingguRph) {
  const tarikh = String(a.tarikh ?? "").localeCompare(String(b.tarikh ?? ""));
  if (tarikh) return tarikh;
  const ha = HARI_LIST.indexOf((a.hari ?? "") as (typeof HARI_LIST)[number]);
  const hb = HARI_LIST.indexOf((b.hari ?? "") as (typeof HARI_LIST)[number]);
  if (ha !== hb) return (ha < 0 ? 99 : ha) - (hb < 0 ? 99 : hb);
  return String(a.masa ?? "").localeCompare(String(b.masa ?? ""));
}

export function kumpulanMingguRph<T extends SlotMingguRph>(rekod: T[]) {
  const adaTarikh = rekod.filter((item) => item.tarikh);
  if (!adaTarikh.length) return [];
  const mula = isninPadaAtauSelepas(
    [...adaTarikh].sort((a, b) => String(a.tarikh).localeCompare(String(b.tarikh)))[0].tarikh as string
  );
  const peta = new Map<number, T[]>();
  for (const item of [...adaTarikh].sort(bandingSesiRph)) {
    const minggu = mingguDari(item.tarikh as string, mula);
    const senarai = peta.get(minggu) ?? [];
    senarai.push(item);
    peta.set(minggu, senarai);
  }
  return [...peta.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([minggu, item]) => ({
      minggu,
      tarikh_mula: item[0]?.tarikh ?? undefined,
      tarikh_tamat: item[item.length - 1]?.tarikh ?? undefined,
      item,
    }));
}

export function rphMingguSemasa<T extends SlotMingguRph>(rekod: T[], id: string) {
  const kumpulan = kumpulanMingguRph(rekod);
  const kumpul = kumpulan.find((item) => item.item.some((row) => row.id === id));
  if (!kumpul) return null;
  const indeks = kumpul.item.findIndex((row) => row.id === id);
  return { ...kumpul, indeks };
}
