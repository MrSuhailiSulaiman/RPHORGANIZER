import { HARI_LIST, type SesiPdp } from "./types";

export { HARI_LIST };

const HARI_ALIAS: Record<string, string> = {
  isnin: "ISNIN",
  isn: "ISNIN",
  monday: "ISNIN",
  mon: "ISNIN",
  selasa: "SELASA",
  sel: "SELASA",
  tuesday: "SELASA",
  tue: "SELASA",
  rabu: "RABU",
  rab: "RABU",
  wednesday: "RABU",
  wed: "RABU",
  khamis: "KHAMIS",
  kha: "KHAMIS",
  thursday: "KHAMIS",
  thu: "KHAMIS",
  jumaat: "JUMAAT",
  jum: "JUMAAT",
  friday: "JUMAAT",
  fri: "JUMAAT",
  sabtu: "SABTU",
  saturday: "SABTU",
  ahad: "AHAD",
  sunday: "AHAD",
};

const SKIP_CELL =
  /^(kosong|rehat|rht|assembly|perhimpunan|n\/a|-|—|–|nil|x)?$/i;

const MATA_PENDEK: Record<string, string> = {
  ask: "ASAS SAINS KOMPUTER",
  "asas sains komputer": "ASAS SAINS KOMPUTER",
  "sc kom": "SAINS KOMPUTER",
  sckom: "SAINS KOMPUTER",
  "sc komputer": "SAINS KOMPUTER",
  "sains komputer": "SAINS KOMPUTER",
  bm: "BAHASA MELAYU",
  "bahasa melayu": "BAHASA MELAYU",
  bi: "BAHASA INGGERIS",
  "bahasa inggeris": "BAHASA INGGERIS",
  pj: "PENDIDIKAN JASMANI",
  pjpk: "PENDIDIKAN JASMANI DAN PENDIDIKAN KESIHATAN",
  rbt: "REKA BENTUK DAN TEKNOLOGI",
  pi: "PENDIDIKAN ISLAM",
  pm: "PENDIDIKAN MORAL",
  sn: "SAINS",
  mat: "MATEMATIK",
  math: "MATEMATIK",
  matematik: "MATEMATIK",
  sej: "SEJARAH",
  sk: "SAINS KOMPUTER",
  geo: "GEOGRAFI",
  muz: "PENDIDIKAN MUZIK",
  sv: "SAINS VOKASIONAL",
};

function kunciMata(value: string) {
  return value
    .toLowerCase()
    .replace(/[./_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type RujukanMataPelajaran = { kod: string; nama: string };

export function namaMataDariKod(value: string, rujukan: RujukanMataPelajaran[] = []) {
  const kunci = kunciMata(value);
  if (!kunci) return "";
  const padan = rujukan.find((item) => {
    const kod = kunciMata(item.kod);
    const nama = kunciMata(item.nama);
    return (kod && kod === kunci) || (nama && nama === kunci);
  });
  if (padan?.nama.trim()) return padan.nama.replace(/\s+/g, " ").trim().toUpperCase();
  return MATA_PENDEK[kunci] ?? "";
}

export function kembangkanMataPelajaran(value: string, rujukan: RujukanMataPelajaran[] = []) {
  const kunci = kunciMata(value);
  if (!kunci) return "";
  return namaMataDariKod(value, rujukan) || value.replace(/\s+/g, " ").trim().toUpperCase();
}

function minitDariMasa(value: string) {
  const match = value.match(/(\d{1,2})[.:](\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function hampirBersambung(tamat: string, mula: string) {
  const a = minitDariMasa(tamat);
  const b = minitDariMasa(mula);
  if (a == null || b == null) return false;
  const jurang = b - a;
  return jurang >= 0 && jurang <= 10;
}

export function cantumSesiBersambung(sesi: SesiPdp[]) {
  const kumpulan = new Map<string, SesiPdp[]>();
  for (const item of sesi) {
    const kunci = [item.hari, item.kelas, item.tingkatan, item.mata_pelajaran]
      .join("|")
      .toLowerCase();
    const senarai = kumpulan.get(kunci) ?? [];
    senarai.push(item);
    kumpulan.set(kunci, senarai);
  }

  const hasil: SesiPdp[] = [];
  for (const senarai of kumpulan.values()) {
    senarai.sort((a, b) => a.masa_mula.localeCompare(b.masa_mula) || a.masa_tamat.localeCompare(b.masa_tamat));
    let semasa = { ...senarai[0] };
    for (const seterusnya of senarai.slice(1)) {
      if (hampirBersambung(semasa.masa_tamat, seterusnya.masa_mula)) {
        semasa = {
          ...semasa,
          masa_tamat: seterusnya.masa_tamat,
          masa: `${semasa.masa_mula} - ${seterusnya.masa_tamat}`,
        };
      } else {
        hasil.push(semasa);
        semasa = { ...seterusnya };
      }
    }
    hasil.push(semasa);
  }
  return hasil;
}

export function parseSelGuru(raw: string): Pick<SesiPdp, "kelas" | "tingkatan" | "mata_pelajaran"> | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || SKIP_CELL.test(text)) return null;
  const match = text.match(/^([1-6])\s*([A-Za-z][A-Za-z0-9]*)(?:\s+(.+))?$/);
  if (!match) return null;
  const mata = kembangkanMataPelajaran((match[3] ?? "").trim());
  if (!mata) return null;
  const pecah = pecahKelas(`${match[1]} ${match[2]}`);
  return {
    kelas: pecah.kelas,
    tingkatan: pecah.tingkatan,
    mata_pelajaran: mata,
  };
}

export function normaliseHari(value: string): string | null {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/hari\s+/g, "")
    .replace(/[^a-z]/g, "");
  return HARI_ALIAS[key] ?? null;
}

export function pecahKelas(raw: string): { kelas: string; tingkatan: string } {
  const text = raw.replace(/\s+/g, " ").trim();
  const match = text.match(/^(?:tingkatan\s*)?([1-5])\s*[:\-/]?\s*(.*)$/i);
  if (match) {
    const namaKelas = match[2].trim();
    return {
      tingkatan: `Tingkatan ${match[1]}`,
      kelas: namaKelas || text,
    };
  }
  return { tingkatan: "", kelas: text };
}

export function normaliseMasa(value: string): { paparan: string; mula: string; tamat: string } | null {
  const text = value.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  const match = text.match(
    /(\d{1,2})[.:](\d{2})\s*(?:pagi|petang|am|pm)?\s*-\s*(\d{1,2})[.:](\d{2})/i
  );
  if (!match) return null;
  const mula = `${match[1].padStart(2, "0")}.${match[2]}`;
  const tamat = `${match[3].padStart(2, "0")}.${match[4]}`;
  return { paparan: `${mula} - ${tamat}`, mula, tamat };
}

function kunciTajuk(value: string) {
  return value
    .toLowerCase()
    .replace(/[_/]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function indeksLajur(headers: string[]) {
  const keys = headers.map(kunciTajuk);
  const find = (...candidates: string[]) =>
    keys.findIndex((key) => candidates.some((item) => key === item || key.includes(item)));
  return {
    kelas: find("kelas", "class"),
    hari: find("hari", "day"),
    masa: find("masa", "waktu", "time", "slot"),
    mata: find("mata pelajaran", "matapelajaran", "subject", "mp"),
    tingkatan: find("tingkatan", "form"),
  };
}

function sesiSah(sesi: SesiPdp) {
  return Boolean(sesi.kelas && sesi.hari && sesi.masa && sesi.mata_pelajaran);
}

function unik(sesi: SesiPdp[]) {
  const seen = new Set<string>();
  return sesi.filter((item) => {
    const key = [item.hari, item.masa, item.kelas, item.mata_pelajaran].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseBaris(rows: string[][]): SesiPdp[] {
  if (rows.length < 2) return [];
  const headerIndex = rows.findIndex((row) => {
    const joined = row.map(kunciTajuk).join(" ");
    return /kelas|hari|masa|mata/.test(joined);
  });
  if (headerIndex < 0) return [];
  const cols = indeksLajur(rows[headerIndex]);
  if (cols.kelas < 0 || cols.hari < 0 || cols.masa < 0 || cols.mata < 0) return [];

  const hasil: SesiPdp[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const kelasRaw = row[cols.kelas]?.trim() ?? "";
    const hari = normaliseHari(row[cols.hari] ?? "");
    const masa = normaliseMasa(row[cols.masa] ?? "");
    const mata = kembangkanMataPelajaran((row[cols.mata] ?? "").replace(/\s+/g, " ").trim());
    if (!kelasRaw || !hari || !masa || !mata || SKIP_CELL.test(mata)) continue;
    const pecah = pecahKelas(kelasRaw);
    const tingkatan =
      cols.tingkatan >= 0 && row[cols.tingkatan]?.trim()
        ? row[cols.tingkatan].trim().startsWith("Tingkatan")
          ? row[cols.tingkatan].trim()
          : `Tingkatan ${row[cols.tingkatan].trim()}`
        : pecah.tingkatan;
    hasil.push({
      kelas: pecah.kelas,
      tingkatan,
      hari,
      masa: masa.paparan,
      masa_mula: masa.mula,
      masa_tamat: masa.tamat,
      mata_pelajaran: mata,
    });
  }
  return hasil.filter(sesiSah);
}

function parseGridHariBaris(rows: string[][]): SesiPdp[] {
  let headerIndex = -1;
  let masaCols: { index: number; masa: NonNullable<ReturnType<typeof normaliseMasa>> }[] = [];
  for (let i = 0; i < Math.min(rows.length, 12); i += 1) {
    const found = rows[i]
      .map((cell, index) => ({ index, masa: normaliseMasa(cell) }))
      .filter(
        (item): item is { index: number; masa: NonNullable<ReturnType<typeof normaliseMasa>> } =>
          Boolean(item.masa)
      );
    if (found.length >= 3) {
      headerIndex = i;
      masaCols = found;
      break;
    }
  }
  if (headerIndex < 0) return [];

  const hasil: SesiPdp[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    let hari: string | null = null;
    let hariIndex = -1;
    for (let i = 0; i < Math.min(row.length, 3); i += 1) {
      hari = normaliseHari(row[i] ?? "");
      if (hari) {
        hariIndex = i;
        break;
      }
    }
    if (!hari) continue;

    for (const col of masaCols) {
      if (col.index === hariIndex) continue;
      const raw = (row[col.index] ?? "").replace(/\s+/g, " ").trim();
      if (!raw || SKIP_CELL.test(raw)) continue;
      const sel = parseSelGuru(raw);
      if (!sel) continue;
      hasil.push({
        ...sel,
        hari,
        masa: col.masa.paparan,
        masa_mula: col.masa.mula,
        masa_tamat: col.masa.tamat,
      });
    }
  }
  return hasil.filter(sesiSah);
}

function parseGrid(rows: string[][]): SesiPdp[] {
  if (!rows.length) return [];
  let headerIndex = -1;
  let hariCols: { index: number; hari: string }[] = [];
  for (let i = 0; i < Math.min(rows.length, 8); i += 1) {
    const found = rows[i]
      .map((cell, index) => ({ index, hari: normaliseHari(cell) }))
      .filter((item): item is { index: number; hari: string } => Boolean(item.hari));
    if (found.length >= 3) {
      headerIndex = i;
      hariCols = found;
      break;
    }
  }
  if (headerIndex < 0) return [];

  const header = rows[headerIndex];
  const masaCol = header.findIndex((cell) => /masa|waktu|time|slot/i.test(cell));
  const kelasCol = header.findIndex((cell) => /kelas|class/i.test(cell));
  const hasil: SesiPdp[] = [];
  let kelasSemasa = "";

  for (const row of rows.slice(headerIndex + 1)) {
    const kelasDariBaris = kelasCol >= 0 ? row[kelasCol]?.trim() : "";
    if (kelasDariBaris) kelasSemasa = kelasDariBaris;
    const masaSel = masaCol >= 0 ? row[masaCol] : row[0];
    const masa = normaliseMasa(masaSel ?? "");
    if (!masa) continue;
    for (const col of hariCols) {
      const raw = (row[col.index] ?? "").replace(/\s+/g, " ").trim();
      if (!raw || SKIP_CELL.test(raw)) continue;
      const bahagian = raw.split(/[|/]/).map((item) => item.trim()).filter(Boolean);
      let mata = bahagian[0] ?? raw;
      let kelas = kelasSemasa;
      if (bahagian.length > 1) {
        const maybeKelas = pecahKelas(bahagian[bahagian.length - 1]);
        if (/[1-5]/.test(bahagian[bahagian.length - 1]) || maybeKelas.tingkatan) {
          kelas = bahagian[bahagian.length - 1];
          mata = bahagian.slice(0, -1).join(" ");
        }
      }
      if (!kelas || !mata) continue;
      const pecah = pecahKelas(kelas);
      hasil.push({
        kelas: pecah.kelas,
        tingkatan: pecah.tingkatan,
        hari: col.hari,
        masa: masa.paparan,
        masa_mula: masa.mula,
        masa_tamat: masa.tamat,
        mata_pelajaran: kembangkanMataPelajaran(mata),
      });
    }
  }
  return hasil.filter(sesiSah);
}

export function lengkapkanSesi(sesi: SesiPdp[], rujukan: RujukanMataPelajaran[] = []) {
  const mapped = sesi
    .map((item) => ({
      ...item,
      mata_pelajaran: kembangkanMataPelajaran(item.mata_pelajaran, rujukan),
    }))
    .filter(sesiSah);
  return susunSesi(unik(cantumSesiBersambung(mapped)));
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === "," || ch === "\t" || ch === ";") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((item) => item)) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((item) => item)) rows.push(row);
  return rows;
}

export function parsePdfJadual(text: string): string[][] {
  return text
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/\u00a0/g, " ")
        .trim()
        .split(/\s{2,}|\t+/)
        .map((cell) => cell.trim())
        .filter(Boolean)
    )
    .filter((row) => row.length >= 2);
}

export type SlotJadual = {
  hari: string;
  masa?: string;
  masa_mula?: string;
  masa_tamat?: string;
  kelas: string;
  mata_pelajaran: string;
};

export function sesiDariSlot(slots: SlotJadual[]): SesiPdp[] {
  const hasil: SesiPdp[] = [];
  for (const slot of slots) {
    const hari = normaliseHari(slot.hari);
    const masa =
      normaliseMasa(slot.masa ?? "") ??
      normaliseMasa(`${slot.masa_mula ?? ""}-${slot.masa_tamat ?? ""}`);
    if (!hari || !masa) continue;
    const gabung = `${slot.kelas} ${slot.mata_pelajaran}`.replace(/\s+/g, " ").trim();
    const sel =
      parseSelGuru(gabung) ??
      (() => {
        const pecah = pecahKelas(slot.kelas);
        const mata = kembangkanMataPelajaran(slot.mata_pelajaran);
        if (!pecah.kelas || !mata || SKIP_CELL.test(mata)) return null;
        return {
          kelas: pecah.kelas,
          tingkatan: pecah.tingkatan,
          mata_pelajaran: mata,
        };
      })();
    if (!sel) continue;
    hasil.push({
      ...sel,
      hari,
      masa: masa.paparan,
      masa_mula: masa.mula,
      masa_tamat: masa.tamat,
    });
  }
  return lengkapkanSesi(hasil);
}

export function parseJadualMatrix(rows: string[][]): SesiPdp[] {
  const bersih = rows
    .map((row) => row.map((cell) => cell.replace(/\u00a0/g, " ").trim()))
    .filter((row) => row.some((cell) => cell));
  const baris = parseBaris(bersih);
  if (baris.length) return lengkapkanSesi(baris);
  const hariBaris = parseGridHariBaris(bersih);
  if (hariBaris.length) return lengkapkanSesi(hariBaris);
  return lengkapkanSesi(parseGrid(bersih));
}

export function susunSesi(sesi: SesiPdp[]) {
  const rank = (hari: string) => {
    const index = HARI_LIST.indexOf(hari as (typeof HARI_LIST)[number]);
    return index < 0 ? 99 : index;
  };
  return [...sesi].sort((a, b) => {
    const hari = rank(a.hari) - rank(b.hari);
    if (hari !== 0) return hari;
    return a.masa_mula.localeCompare(b.masa_mula) || a.kelas.localeCompare(b.kelas);
  });
}

export function tarikhUntukHari(hari: string, dari = new Date()) {
  const rank = HARI_LIST.indexOf(hari as (typeof HARI_LIST)[number]);
  if (rank < 0) {
    return dari.toISOString().slice(0, 10);
  }
  const jsDay = dari.getDay();
  const target = rank + 1;
  let delta = target - jsDay;
  if (delta < 0) delta += 7;
  const next = new Date(dari);
  next.setDate(dari.getDate() + delta);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const CONTOH_CSV = `KELAS,HARI,MASA,MATA PELAJARAN
5 UTM,ISNIN,11.40 - 13.00,SAINS KOMPUTER
5 UTM,RABU,09.40 - 10.40,SAINS KOMPUTER
4 BESTARI,SELASA,07.40 - 08.40,MATEMATIK
`;
