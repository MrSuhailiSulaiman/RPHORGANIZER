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
    const mata = (row[cols.mata] ?? "").replace(/\s+/g, " ").trim();
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
      mata_pelajaran: mata.toUpperCase(),
    });
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
        mata_pelajaran: mata.toUpperCase(),
      });
    }
  }
  return hasil.filter(sesiSah);
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

export function parseJadualMatrix(rows: string[][]): SesiPdp[] {
  const bersih = rows
    .map((row) => row.map((cell) => cell.replace(/\u00a0/g, " ").trim()))
    .filter((row) => row.some((cell) => cell));
  const baris = parseBaris(bersih);
  if (baris.length) return unik(baris);
  return unik(parseGrid(bersih));
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
