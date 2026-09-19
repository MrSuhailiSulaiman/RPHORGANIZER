import type { BidangPembelajaran, DskpExtract, StandardKandungan, StandardPembelajaran } from "./types";

const HEADER_PATTERNS = [
  /KSSM[^\n]*TINGKATAN\s+\d+/gi,
  /STANDARD\s+KANDUNGAN/gi,
  /STANDARD\s+PEMBELAJARAN/gi,
  /STANDARD\s+PRESTASI/gi,
  /TAHAP\s*PENGUASAAN/gi,
  /\bTAFSIRAN\b/gi,
  /\bPROJEK\b/g,
  /Murid boleh\s*:/gi,
];

const CODE_RE = /(\d+\.\d+\.\d+|\d+\.0|\d+\.\d+)/g;

const TP_CUT =
  /\s1\s+(?:Menyatakan|Menerangkan|Menggunakan|Membuat|Memberi|Mencadangkan|Menulis|Melukis|Melaksanakan|Mencari|Menilai|Menghasilkan|Mengenalpasti|Membangunkan|Mengemas|Mengesan|Menentukan|Memilih|Membina|Membanding|Mengkategorikan|Menghuraikan|Menunjukkan|Menjelaskan|Mereka|Mencipta|Menyenaraikan|Mengkaji|Membanding beza)/;

function normalise(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n/g, "\n");
}

function cleanNoise(text: string) {
  let next = text;
  for (const pattern of HEADER_PATTERNS) {
    next = next.replace(pattern, " ");
  }
  return next.replace(/\n{2,}/g, "\n").trim();
}

function titleCaseNama(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\bDan\b/g, "dan")
    .replace(/\bAtau\b/g, "atau")
    .trim();
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitButiran(text: string): { pernyataan: string; butiran: string[] } {
  const parts = compact(text).split(/\s*(?=\([ivx]+\))/i);
  if (parts.length <= 1) {
    return { pernyataan: compact(text), butiran: [] };
  }
  const pernyataan = compact(parts[0] ?? "");
  const butiran = parts
    .slice(1)
    .map((part) => compact(part.replace(/^\([ivx]+\)\s*/i, "")))
    .filter(Boolean);
  return { pernyataan, butiran };
}

function cutPrestasi(body: string) {
  const idx = body.search(TP_CUT);
  return idx >= 0 ? body.slice(0, idx) : body;
}

function extractMetadata(text: string) {
  const header = text.match(/KSSM\s+(.+?)\s+TINGKATAN\s+(\d+)/i);
  const subjectFromCover = text.match(/Sains Komputer|Asas Sains Komputer|Matematik|Bahasa Melayu|Bahasa Inggeris|Sains|Sejarah|Geografi|Pendidikan Islam|Reka Bentuk dan Teknologi/i);
  const tahun =
    text.match(/Terbitan\s+(\d{4})/i)?.[1] ??
    text.match(/\b(?:Januari|Februari|Mac|April|Mei|Jun|Julai|Ogos|September|Oktober|November|Disember)\s+(\d{4})/i)?.[1] ??
    null;

  return {
    mata_pelajaran: titleCaseNama(compact(header?.[1] ?? subjectFromCover?.[0] ?? "Tidak dikenal pasti")),
    tingkatan: header?.[2] ? `Tingkatan ${header[2]}` : (text.match(/Tingkatan\s+(\d+)/i)?.[0] ?? ""),
    tahun_terbitan: tahun,
  };
}

function extractJam(text: string) {
  const jadual = (text.match(/Jadual\s*4[\s\S]{0,2500}?Jumlah\s+\d+/i)?.[0] ?? "").replace(
    /Jumlah\s+\d+/i,
    ""
  );
  const jamByKod = new Map<string, number>();
  const chunks = jadual.split(/(?=\d+\.0\s)/);
  for (const chunk of chunks) {
    const kod = chunk.match(/^(\d+)\.0\b/)?.[0];
    if (!kod) continue;
    const numbers = [...chunk.matchAll(/\b(\d{1,3})\b/g)].map((m) => Number(m[1]));
    const jam = numbers.filter((n) => n >= 4 && n <= 200).at(-1);
    if (jam != null) jamByKod.set(kod, jam);
  }
  return jamByKod;
}

function extractPenerangan(text: string) {
  const map = new Map<string, string>();
  const table = text.match(/Jadual\s*9[\s\S]{0,4000}?(?=STANDARD KANDUNGAN,|1\.0\s+PENGATURCARAAN)/i)?.[0] ?? "";
  const rows = table.split(/\n(?=[A-Z])/);
  for (const row of rows) {
    const compactRow = compact(row);
    if (/^Pengaturcaraan\b/i.test(compactRow)) {
      map.set("pengaturcaraan", compactRow.replace(/^Pengaturcaraan\s+/i, ""));
    } else if (/^Pangkalan Data\b/i.test(compactRow)) {
      map.set("pangkalan data", compactRow.replace(/^Pangkalan Data\s+/i, ""));
    } else if (/^Interaksi Manusia/i.test(compactRow)) {
      map.set("interaksi manusia dan komputer", compactRow.replace(/^Interaksi Manusia(?: dan Komputer)?\s+/i, ""));
    }
  }
  return map;
}

function isBidangKod(kod: string) {
  return /^\d+\.0$/.test(kod);
}

function isSkKod(kod: string) {
  return /^\d+\.\d+$/.test(kod) && !isBidangKod(kod);
}

function isSpKod(kod: string) {
  return /^\d+\.\d+\.\d+$/.test(kod);
}

export function teksKurikulumDskp(text: string) {
  return contentSection(text);
}

function contentSection(text: string) {
  const marker = text.search(/STANDARD KANDUNGAN,\s*STANDARD PEMBELAJARAN/i);
  let section = marker >= 0 ? text.slice(marker) : text;
  const start = section.search(/\b1\.0\s+/i);
  if (start >= 0) section = section.slice(start);
  const end = section.search(/\bGLOSARI\b/i);
  if (end > 0) section = section.slice(0, end);
  return section;
}

type Token = { kod: string; body: string };

function tokenize(section: string): Token[] {
  const cleaned = cleanNoise(section);
  const joined = cleaned.replace(/\n+/g, " ");
  const tokens: Token[] = [];
  const matches = [...joined.matchAll(CODE_RE)];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const kod = match[1];
    if (!kod || match.index == null) continue;
    if (!isBidangKod(kod) && !isSkKod(kod) && !isSpKod(kod)) continue;
    const bodyStart = match.index + match[0].length;
    const bodyEnd = matches[i + 1]?.index ?? joined.length;
    const body = joined.slice(bodyStart, bodyEnd);
    tokens.push({ kod, body: cutPrestasi(body) });
  }
  return tokens;
}

export function parseDskpText(rawText: string): DskpExtract {
  const text = normalise(rawText);
  const metadata = extractMetadata(text);
  const jamByKod = extractJam(text);
  const peneranganByNama = extractPenerangan(text);
  const tokens = tokenize(contentSection(text));

  const bidang: BidangPembelajaran[] = [];
  let currentBidang: BidangPembelajaran | null = null;
  let currentSk: StandardKandungan | null = null;

  for (const token of tokens) {
    if (isBidangKod(token.kod)) {
      const nama = titleCaseNama(compact(token.body).split(/(?=\d+\.\d+)/)[0] ?? token.body);
      currentBidang = {
        kod: token.kod,
        nama: nama || `Bidang ${token.kod}`,
        penerangan: peneranganByNama.get(nama.toLowerCase()) ?? null,
        jam: jamByKod.get(token.kod) ?? null,
        standard_kandungan: [],
      };
      bidang.push(currentBidang);
      currentSk = null;
      continue;
    }

    if (isSkKod(token.kod)) {
      if (!currentBidang) {
        currentBidang = {
          kod: `${token.kod.split(".")[0]}.0`,
          nama: "Bidang",
          penerangan: null,
          jam: null,
          standard_kandungan: [],
        };
        bidang.push(currentBidang);
      }
      currentSk = {
        kod: token.kod,
        tajuk: compact(token.body) || token.kod,
        standard_pembelajaran: [],
      };
      currentBidang.standard_kandungan.push(currentSk);
      continue;
    }

    if (isSpKod(token.kod)) {
      if (!currentSk) {
        continue;
      }
      const { pernyataan, butiran } = splitButiran(token.body);
      const sp: StandardPembelajaran = {
        kod: token.kod,
        pernyataan: pernyataan || token.body.trim(),
        butiran,
      };
      currentSk.standard_pembelajaran.push(sp);
    }
  }

  return {
    ...metadata,
    bidang,
    kaedah_analisis: "parser",
  };
}

export function ringkasanExtract(extract: DskpExtract) {
  const bilSk = extract.bidang.reduce((sum, bidang) => sum + bidang.standard_kandungan.length, 0);
  const bilSp = extract.bidang.reduce(
    (sum, bidang) =>
      sum + bidang.standard_kandungan.reduce((inner, sk) => inner + sk.standard_pembelajaran.length, 0),
    0
  );
  return {
    bilBidang: extract.bidang.length,
    bilSk,
    bilSp,
  };
}
