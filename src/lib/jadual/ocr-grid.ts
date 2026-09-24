import {
  lengkapkanSesi,
  namaMataDariKod,
  normaliseHari,
  sesiDariSlot,
  type RujukanMataPelajaran,
  type SlotJadual,
} from "./parse";
import type { SesiPdp } from "./types";

export type Perkataan = {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  xc: number;
  yc: number;
};

const SLOT_SIDANG_PAGI: [string, string][] = [
  ["06.30", "06.40"],
  ["06.40", "07.20"],
  ["07.20", "08.00"],
  ["08.00", "08.40"],
  ["08.40", "09.20"],
  ["09.00", "09.40"],
  ["09.40", "10.20"],
  ["10.20", "11.00"],
  ["11.00", "11.40"],
  ["11.40", "12.20"],
  ["12.20", "13.00"],
  ["13.00", "13.40"],
  ["13.45", "14.20"],
  ["14.20", "15.00"],
];

function xc(word: { x0: number; x1: number }) {
  return (word.x0 + word.x1) / 2;
}

function klusterNilai(nilai: number[], jurang: number) {
  const susun = [...nilai].sort((a, b) => a - b);
  const kumpulan: number[][] = [];
  for (const item of susun) {
    const terakhir = kumpulan[kumpulan.length - 1];
    if (!terakhir || item - terakhir[terakhir.length - 1] > jurang) {
      kumpulan.push([item]);
    } else {
      terakhir.push(item);
    }
  }
  return kumpulan.map((senarai) => senarai.reduce((a, b) => a + b, 0) / senarai.length);
}

function nampakNomborSlot(text: string) {
  return /^(1[0-2]|[0-9])$/.test(text.trim());
}

function minitDari(value: string) {
  const match = value.match(/(\d{1,2})[.:](\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function slotSah(mula: string, tamat: string) {
  const a = minitDari(mula);
  const b = minitDari(tamat);
  if (a == null || b == null) return false;
  const lama = b - a;
  return a >= 6 * 60 && lama >= 5 && lama <= 90;
}

function parseJamOcr(text: string, rujukan?: string): string | null {
  const digit = text.replace(/\D/g, "");
  if (digit.length === 4) {
    const jam = Number(digit.slice(0, 2));
    const minit = Number(digit.slice(2));
    if (jam >= 6 && jam <= 23 && minit <= 59) {
      return `${String(jam).padStart(2, "0")}.${String(minit).padStart(2, "0")}`;
    }
  }
  if (digit.length === 3) {
    const jam = Number(digit[0]);
    const minit = Number(digit.slice(1));
    if (jam >= 6 && jam <= 9 && minit <= 59) {
      return `${String(jam).padStart(2, "0")}.${String(minit).padStart(2, "0")}`;
    }
    if (digit[0] === "1" && minit <= 59) {
      if (digit.slice(1) === "20") return "12.20";
      if (digit.slice(1) === "40") return "11.40";
      if (rujukan?.startsWith("11")) return `11.${digit.slice(1)}`;
      if (rujukan?.startsWith("12")) return `12.${digit.slice(1)}`;
    }
  }
  return null;
}

function normaliseHariOcr(value: string): string | null {
  const tepat = normaliseHari(value);
  if (tepat) return tepat;
  const t = value.toLowerCase().replace(/[^a-z]/g, "");
  if (t.length < 3) return null;
  if (t === "isnin" || t.startsWith("isn")) return "ISNIN";
  if (t === "selasa" || t.startsWith("selas") || t === "sel") return "SELASA";
  if (t === "rabu" || t.startsWith("rab")) return "RABU";
  if (t === "khamis" || t.startsWith("kha") || t.includes("hamis")) return "KHAMIS";
  if (t === "jumaat" || t.startsWith("juma")) return "JUMAAT";
  return null;
}

function normaliseKelasOcr(raw: string): string | null {
  let token = raw.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (token.length < 3 || token.length > 12) return null;
  if (/^(SAINS|KOMPUTER|ASAS|JADUAL|GURU|SIDANG|PAGI|TAHUN|SUBJEK|KELAS|JUMLAH|DISAHKAN|SEKOLAH)/.test(token)) {
    return null;
  }
  token = token.replace(/^A(?=[A-Z0-9])/, "4").replace(/^S(?=U)/, "5");
  const named = token.match(/^([1-6])([A-Z]{2,})$/);
  if (named) {
    const kod =
      named[2] === "US" || named[2] === "UM"
        ? named[2] === "US"
          ? "USM"
          : "UTM"
        : named[2] === "UT"
          ? "UTM"
          : named[2];
    return `${named[1]} ${kod}`;
  }
  if (/^(UTM|USM)$/.test(token)) return token;
  return null;
}

function nampakAsk(text: string) {
  const s = text.toLowerCase().replace(/[^a-z]/g, "");
  return s === "ask" || s.includes("asas");
}

function nampakScKom(text: string) {
  const s = text.toLowerCase().replace(/[^a-z]/g, "");
  if (!s || s.length > 8) return false;
  return (
    s.includes("sc") ||
    s.includes("kom") ||
    s === "snow" ||
    s === "crow" ||
    s === "scrou" ||
    s === "scuou" ||
    s === "scvou"
  );
}

function kelasRingkasan(words: Perkataan[], yMin: number, rujukan: RujukanMataPelajaran[]) {
  const bawah = words.filter((word) => word.yc > yMin);
  const hasil = new Map<string, string>();
  const baris = klusterNilai(
    bawah.map((word) => word.yc),
    10
  );
  for (const y of baris) {
    const token = bawah
      .filter((word) => Math.abs(word.yc - y) <= 8)
      .sort((a, b) => a.x0 - b.x0)
      .map((word) => word.text)
      .join(" ");
    const kelas = token.match(/\b([1-6])\s*(USM|UTM)\b/i) ?? token.match(/\b([1-6])(USM|UTM)\b/i);
    if (!kelas) continue;
    const namaKelas = `${kelas[1]} ${kelas[2].toUpperCase()}`;
    const daripadaKod = token
      .split(/\s+/)
      .map((bahagian) => namaMataDariKod(bahagian, rujukan))
      .find(Boolean);
    const mata =
      daripadaKod ||
      (/asas|\bsas\b/i.test(token)
        ? "ASAS SAINS KOMPUTER"
        : /sains|komputer/i.test(token)
          ? "SAINS KOMPUTER"
          : "");
    if (mata) hasil.set(namaKelas, mata);
  }
  return hasil;
}

function lengkapkanKelas(token: string, diletak: string[], ringkasan: string[]) {
  if (/^[1-6]\s/.test(token)) return token;
  const calon = ringkasan.filter((item) => item.endsWith(` ${token}`) || item.split(/\s+/).pop() === token);
  if (!calon.length) return token;
  const kira = (nama: string) => diletak.filter((item) => item === nama).length;
  return [...calon].sort((a, b) => kira(a) - kira(b))[0];
}

function mataUntukKelas(kelas: string, ringkasan: Map<string, string>, petunjuk?: string) {
  if (petunjuk === "ASK" || kelas.startsWith("3 ")) return "ASAS SAINS KOMPUTER";
  if (petunjuk === "SC") return "SAINS KOMPUTER";
  return ringkasan.get(kelas) ?? "SAINS KOMPUTER";
}

export function perkataanDariBlok(blocks: unknown): Perkataan[] {
  const words: Perkataan[] = [];
  const senarai = (blocks as { paragraphs?: { lines?: { words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }[] | undefined) ?? [];
  for (const block of senarai) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) {
          const text = word.text.replace(/\s+/g, "").trim();
          if (!text) continue;
          words.push({
            text,
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1,
            xc: xc(word.bbox),
            yc: (word.bbox.y0 + word.bbox.y1) / 2,
          });
        }
      }
    }
  }
  return words;
}

export function perkataanDariTsv(tsv: string): Perkataan[] {
  const words: Perkataan[] = [];
  for (const line of tsv.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split("\t");
    if (cols.length < 12 || cols[0] !== "5") continue;
    const left = Number(cols[6]);
    const top = Number(cols[7]);
    const width = Number(cols[8]);
    const height = Number(cols[9]);
    const text = cols.slice(11).join("\t").replace(/\s+/g, "").trim();
    if (!text || Number.isNaN(left)) continue;
    words.push({
      text,
      x0: left,
      y0: top,
      x1: left + width,
      y1: top + height,
      xc: left + width / 2,
      yc: top + height / 2,
    });
  }
  return words;
}

export function sesiDariOcr(words: Perkataan[], rujukan: RujukanMataPelajaran[] = []): SesiPdp[] {
  const hariWords = words
    .map((word) => ({ word, hari: normaliseHariOcr(word.text) }))
    .filter((item): item is { word: Perkataan; hari: string } => Boolean(item.hari));
  if (hariWords.length < 3) return [];

  const yHari = hariWords.map((item) => item.word.yc);
  const yHariMin = Math.min(...yHari);
  const yHariMax = Math.max(...yHari);
  const xHariMax = Math.max(...hariWords.map((item) => item.word.x1));

  const header = words.filter((word) => word.yc < yHariMin - 4 && word.yc > yHariMin - 90);
  let lajurX = klusterNilai(
    header
      .filter((word) => {
        const digit = word.text.replace(/\D/g, "");
        return digit.length >= 3 || Boolean(parseJamOcr(word.text));
      })
      .map((word) => word.xc),
    35
  ).filter((x) => x > xHariMax + 10);

  if (lajurX.length < 4) {
    const kelasX = words
      .filter((word) => word.yc >= yHariMin - 8 && word.yc <= yHariMax + 28 && Boolean(normaliseKelasOcr(word.text)))
      .map((word) => word.xc);
    if (kelasX.length >= 2) {
      const kiri = Math.min(...kelasX) - 20;
      const kanan = Math.max(...kelasX) + 20;
      const bilangan = SLOT_SIDANG_PAGI.length;
      const lebar = (kanan - kiri) / bilangan;
      lajurX = SLOT_SIDANG_PAGI.map((_, index) => kiri + lebar * (index + 0.5));
    }
  }

  if (lajurX.length < 4) return [];

  const slotMasa = lajurX.map((x, index) => {
    const fallback = SLOT_SIDANG_PAGI[index] ?? SLOT_SIDANG_PAGI[SLOT_SIDANG_PAGI.length - 1];
    const hampir = header
      .filter((word) => Math.abs(word.xc - x) < 22 && !nampakNomborSlot(word.text))
      .sort((a, b) => a.yc - b.yc);
    const jam = hampir
      .map((word) => parseJamOcr(word.text))
      .filter((item): item is string => Boolean(item));
    if (jam.length >= 2 && slotSah(jam[0], jam[jam.length - 1])) {
      return { x, mula: jam[0], tamat: jam[jam.length - 1] };
    }
    if (hampir.length >= 2) {
      const atas = parseJamOcr(hampir[0].text);
      const bawah = parseJamOcr(hampir[hampir.length - 1].text, atas ?? undefined);
      if (atas && bawah && slotSah(atas, bawah)) {
        return { x, mula: atas, tamat: bawah };
      }
    }
    if (jam.length === 1 && slotSah(jam[0], fallback[1])) {
      return { x, mula: jam[0], tamat: fallback[1] };
    }
    if (jam.length === 2 && slotSah(jam[0], jam[1])) {
      return { x, mula: jam[0], tamat: jam[1] };
    }
    return { x, mula: fallback[0], tamat: fallback[1] };
  });

  const ringkasan = kelasRingkasan(words, yHariMax + 40, rujukan);
  const namaRingkasan = [...ringkasan.keys()];
  const diletak: string[] = [];
  const slots: SlotJadual[] = [];

  const kelasWords = words.filter((word) => {
    if (word.yc < yHariMin - 8 || word.yc > yHariMax + 28) return false;
    if (word.xc < xHariMax + 20) return false;
    return Boolean(normaliseKelasOcr(word.text));
  });

  for (const word of kelasWords) {
    const hariItem = [...hariWords].sort(
      (a, b) => Math.abs(a.word.yc - word.yc) - Math.abs(b.word.yc - word.yc)
    )[0];
    if (!hariItem || Math.abs(hariItem.word.yc - word.yc) > 28) continue;

    const lajur = [...slotMasa].sort((a, b) => Math.abs(a.x - word.xc) - Math.abs(b.x - word.xc))[0];
    if (!lajur || Math.abs(lajur.x - word.xc) > 80) continue;

    const mentah = normaliseKelasOcr(word.text);
    if (!mentah) continue;
    const kelas = lengkapkanKelas(mentah, diletak, namaRingkasan);
    diletak.push(kelas);

    const bawah = words.filter(
      (item) =>
        item.yc > word.y1 - 2 &&
        item.yc < word.y1 + 28 &&
        Math.abs(item.xc - word.xc) < 45
    );
    const daripadaKod = bawah.map((item) => namaMataDariKod(item.text, rujukan)).find(Boolean);
    const petunjuk = bawah.some((item) => nampakAsk(item.text))
      ? "ASK"
      : bawah.some((item) => nampakScKom(item.text))
        ? "SC"
        : undefined;

    slots.push({
      hari: hariItem.hari,
      masa_mula: lajur.mula,
      masa_tamat: lajur.tamat,
      kelas,
      mata_pelajaran: daripadaKod || mataUntukKelas(kelas, ringkasan, petunjuk),
    });
  }

  const susunMasa = [...slotMasa].sort((a, b) => a.mula.localeCompare(b.mula));
  const digabung = slots.map((slot) => {
    const mulaMinit = minitDari(slot.masa_mula ?? "") ?? 0;
    if (mulaMinit < 13 * 60) return slot;
    const indeks = susunMasa.findIndex(
      (item) => item.mula === slot.masa_mula && item.tamat === slot.masa_tamat
    );
    const seterusnya = indeks >= 0 ? susunMasa[indeks + 1] : undefined;
    if (!seterusnya) return slot;
    const jurang = (minitDari(seterusnya.mula) ?? 0) - (minitDari(slot.masa_tamat ?? "") ?? 0);
    if (jurang < 0 || jurang > 10) return slot;
    const terisi = slots.some(
      (lain) => lain !== slot && lain.hari === slot.hari && lain.masa_mula === seterusnya.mula
    );
    if (terisi) return slot;
    return { ...slot, masa_tamat: seterusnya.tamat };
  });

  return sesiDariSlot(digabung);
}

export function sesiLengkapDariOcr(
  words: Perkataan[],
  rujukan: RujukanMataPelajaran[] = []
): SesiPdp[] {
  if (!words.length) {
    throw new Error(
      "Gambar jadual tidak dapat dibaca. Cuba JPG/PNG yang terang, atau tukar HEIC kepada JPG."
    );
  }
  const sesi = lengkapkanSesi(sesiDariOcr(words, rujukan), rujukan);
  if (!sesi.length) {
    throw new Error(
      "Grid hari dan kelas tidak dikenali. Pastikan baris Isnin–Jumaat dan nama kelas nampak jelas."
    );
  }
  return sesi;
}
