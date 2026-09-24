import type { BidangPembelajaran, DskpExtract, StandardKandungan, StandardPembelajaran } from "./types";

const HEADER_PATTERNS = [
  /KSSM[^\n]*TINGKATAN\s+\d+/gi,
  /STANDARD\s+KANDUNGAN/gi,
  /STANDARD\s+PEMBELAJARAN/gi,
  /\bPROJEK\b/g,
  /Murid boleh\s*:/gi,
];

const CODE_RE = /(\d+(?:\.\d+){1,2})/g;

const PENANDA_TP =
  /\b(?:TAHAP\s*PENGUASAAN|STANDARD\s+PRESTASI|TAFSIRAN|RUBRIK(?:\s+PRESTASI)?|TP\s*[1-6])\b/i;

const PENANDA_CADANGAN =
  /\b(?:CADANGAN\s+AKTIVITI(?:\s+PdP)?|CADANGAN\s+PENGAJARAN(?:\s+DAN\s+PEMBELAJARAN)?|AKTIVITI\s+CADANGAN)\b/i;

const KATA_KERJA_TP =
  "(?:Murid\\s+)?(?:dapat\\s+|boleh\\s+)?(?:Men|Mem|Meng|Mel|Mer|Menc)[A-Za-z]{3,}";

const TP_BERTURUT =
  new RegExp(`\\s1[\\.\\)\\:]?\\s+${KATA_KERJA_TP}[\\s\\S]{0,280}?\\s2[\\.\\)\\:]?\\s+${KATA_KERJA_TP}`, "i");

const TP_TAHAP_SATU =
  /\s1[\.\)\:]?\s+(?:Murid\s+)?(?:dapat\s+|boleh\s+)?Menyatakan\b/i;

export function indeksTahapPenguasaan(text: string) {
  const calon: number[] = [];
  const penanda = text.search(PENANDA_TP);
  if (penanda >= 0) calon.push(penanda);
  const cadangan = text.search(PENANDA_CADANGAN);
  if (cadangan >= 0) calon.push(cadangan);
  const berturut = text.search(TP_BERTURUT);
  if (berturut >= 0) calon.push(berturut);
  const tahapSatu = text.search(TP_TAHAP_SATU);
  if (tahapSatu >= 0) calon.push(tahapSatu);
  return calon.length ? Math.min(...calon) : -1;
}

export function buangTahapPenguasaan(text: string) {
  const idx = indeksTahapPenguasaan(text);
  const terpotong = idx >= 0 ? text.slice(0, idx) : text;
  return compact(
    terpotong
      .replace(
        /\b(?:STANDARD\s+PRESTASI|TAHAP\s*PENGUASAAN|TAFSIRAN|RUBRIK|CADANGAN\s+AKTIVITI(?:\s+PdP)?|CADANGAN\s+PENGAJARAN(?:\s+DAN\s+PEMBELAJARAN)?|AKTIVITI\s+CADANGAN)\b/gi,
        " "
      )
      .replace(/\s+/g, " ")
  );
}

function butiranTanpaTp(butiran: string[]) {
  return butiran
    .map((item) => buangTahapPenguasaan(item))
    .map((item) => compact(item.replace(/^\([ivx]+\)\s*/i, "")))
    .filter((item) => {
      if (!item) return false;
      if (/^(?:[1-6][\.\)\:]?|TP\s*[1-6])\b/i.test(item)) return false;
      if (/^(?:Tahap\s*Penguasaan|Tafsiran|Standard\s+Prestasi|Cadangan\s+Aktiviti)\b/i.test(item)) {
        return false;
      }
      if (/^(?:Guru\s+(?:membimbing|menunjukkan|mengedar|melaksanakan)|Murid\s+(?:menjalankan|membincangkan)\s)/i.test(item)) {
        return false;
      }
      return item.length > 2;
    });
}

export function bersihkanExtractDskp<T extends { bidang: BidangPembelajaran[] }>(extract: T): T {
  const bidang = extract.bidang.map((bidang) => ({
    ...bidang,
    nama: buangTahapPenguasaan(bidang.nama) || bidang.nama,
    standard_kandungan: bidang.standard_kandungan.map((sk) => ({
      ...sk,
      tajuk: buangTahapPenguasaan(sk.tajuk) || sk.kod,
      standard_pembelajaran: sk.standard_pembelajaran.map((sp) => {
        const { pernyataan, butiran } = splitButiran(buangTahapPenguasaan(sp.pernyataan));
        return {
          ...sp,
          pernyataan: pernyataan || compact(sp.pernyataan),
          butiran: [...new Set(butiranTanpaTp([...butiran, ...sp.butiran]))],
        };
      }),
    })),
  }));
  return {
    ...extract,
    bidang: susunMengikutArasKod(bidang),
  };
}

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
  return buangTahapPenguasaan(body);
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

export function kodBersih(kod: string) {
  return kod.trim().replace(/\s+/g, "").replace(/\.+$/g, "");
}

/** 1.0 bidang, 1.1 standard kandungan, 1.1.1 atau 3.3.11 standard pembelajaran. */
export function arasKod(kod: string): "bidang" | "sk" | "sp" | "" {
  const nilai = kodBersih(kod);
  const nombor = Number(nilai.split(".")[0]);
  if (!Number.isInteger(nombor) || nombor < 1 || nombor > 40) return "";
  if (/^\d+\.0$/.test(nilai)) return "bidang";
  if (/^\d+\.\d+$/.test(nilai)) return "sk";
  if (/^\d+\.\d+\.\d+$/.test(nilai)) return "sp";
  return "";
}

function kodBidang(kod: string) {
  return `${kodBersih(kod).split(".")[0]}.0`;
}

function kodSk(kod: string) {
  const [pertama, kedua] = kodBersih(kod).split(".");
  return `${pertama}.${kedua}`;
}

function bandingKod(a: string, b: string) {
  const kiri = kodBersih(a).split(".").map((bahagian) => Number(bahagian) || 0);
  const kanan = kodBersih(b).split(".").map((bahagian) => Number(bahagian) || 0);
  const panjang = Math.max(kiri.length, kanan.length);
  for (let i = 0; i < panjang; i += 1) {
    const beza = (kiri[i] ?? 0) - (kanan[i] ?? 0);
    if (beza) return beza;
  }
  return 0;
}

function tajukLemah(tajuk: string, kod: string) {
  const nilai = tajuk.trim();
  return !nilai || nilai === kod || nilai === "Bidang" || nilai === "Standard Kandungan";
}

/** Letak semula setiap kod pada aras nombornya, walaupun AI atau parser meletak di tempat lain. */
export function susunMengikutArasKod(senarai: BidangPembelajaran[]): BidangPembelajaran[] {
  const bidangPeta = new Map<string, BidangPembelajaran>();
  const skPeta = new Map<string, StandardKandungan>();
  const spPeta = new Map<string, StandardPembelajaran>();

  function pastikanBidang(kod: string, sumber?: Partial<BidangPembelajaran>) {
    const sedia = bidangPeta.get(kod);
    if (sedia) {
      if (sumber?.nama && tajukLemah(sedia.nama, kod) && !tajukLemah(sumber.nama, kod)) sedia.nama = sumber.nama;
      if (sedia.penerangan == null && sumber?.penerangan) sedia.penerangan = sumber.penerangan;
      if (sedia.jam == null && sumber?.jam != null) sedia.jam = sumber.jam;
      return sedia;
    }
    const baru: BidangPembelajaran = {
      kod,
      nama: sumber?.nama && !tajukLemah(sumber.nama, kod) ? sumber.nama : `Bidang ${kod}`,
      penerangan: sumber?.penerangan ?? null,
      jam: sumber?.jam ?? null,
      standard_kandungan: [],
    };
    bidangPeta.set(kod, baru);
    return baru;
  }

  function pastikanSk(kod: string, sumber?: Partial<StandardKandungan>) {
    if (arasKod(kod) !== "sk") return null;
    const sedia = skPeta.get(kod);
    if (sedia) {
      if (sumber?.tajuk && tajukLemah(sedia.tajuk, kod) && !tajukLemah(sumber.tajuk, kod)) {
        sedia.tajuk = sumber.tajuk;
      }
      return sedia;
    }
    const bidang = pastikanBidang(kodBidang(kod));
    const baru: StandardKandungan = {
      kod,
      tajuk: sumber?.tajuk && !tajukLemah(sumber.tajuk, kod) ? sumber.tajuk : kod,
      standard_pembelajaran: [],
    };
    skPeta.set(kod, baru);
    bidang.standard_kandungan.push(baru);
    return baru;
  }

  function simpanSp(sp: StandardPembelajaran) {
    const kod = kodBersih(sp.kod);
    if (arasKod(kod) !== "sp") return;
    const sedia = spPeta.get(kod);
    if (!sedia || sp.pernyataan.trim().length > sedia.pernyataan.trim().length) {
      spPeta.set(kod, { ...sp, kod });
    }
  }

  for (const bidang of senarai) {
    const kodBidangItem = kodBersih(bidang.kod);
    if (arasKod(kodBidangItem) === "bidang") pastikanBidang(kodBidangItem, bidang);
    else if (arasKod(kodBidangItem) === "sk") pastikanSk(kodBidangItem, { tajuk: bidang.nama });
    else if (arasKod(kodBidangItem) === "sp") {
      simpanSp({ kod: kodBidangItem, pernyataan: bidang.nama, butiran: [] });
    }

    for (const sk of bidang.standard_kandungan) {
      const kodSkItem = kodBersih(sk.kod);
      if (arasKod(kodSkItem) === "sk") pastikanSk(kodSkItem, sk);
      else if (arasKod(kodSkItem) === "bidang") pastikanBidang(kodSkItem, { nama: sk.tajuk });
      else if (arasKod(kodSkItem) === "sp") {
        simpanSp({ kod: kodSkItem, pernyataan: sk.tajuk, butiran: [] });
      }

      for (const sp of sk.standard_pembelajaran) {
        const kodSp = kodBersih(sp.kod);
        if (arasKod(kodSp) === "sp") simpanSp({ ...sp, kod: kodSp });
        else if (arasKod(kodSp) === "sk") pastikanSk(kodSp, { tajuk: sp.pernyataan });
        else if (arasKod(kodSp) === "bidang") pastikanBidang(kodSp, { nama: sp.pernyataan });
      }
    }
  }

  for (const [kod, sp] of spPeta) {
    const sk = pastikanSk(kodSk(kod));
    if (!sk || sk.standard_pembelajaran.some((item) => item.kod === kod)) continue;
    sk.standard_pembelajaran.push(sp);
  }

  return [...bidangPeta.values()]
    .map((bidang) => ({
      ...bidang,
      standard_kandungan: [...bidang.standard_kandungan]
        .map((sk) => ({
          ...sk,
          standard_pembelajaran: [...sk.standard_pembelajaran].sort((a, b) => bandingKod(a.kod, b.kod)),
        }))
        .sort((a, b) => bandingKod(a.kod, b.kod)),
    }))
    .filter((bidang) => bidang.standard_kandungan.length || !tajukLemah(bidang.nama, bidang.kod))
    .sort((a, b) => bandingKod(a.kod, b.kod));
}

export function teksKurikulumDskp(text: string) {
  const tokens = tokenize(contentSection(normalise(text)));
  const kurikulum = tokens
    .map((token) => compact(`${token.kod} ${token.body}`))
    .filter(Boolean)
    .join("\n");
  return kurikulum || contentSection(text);
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

const KOD_SP_SAHAJA = /^(\d+\.\d+\.\d+)\s*$/;
const MULA_AYAT_SP = /^(?:Men|Mem|Meng|Mel|Mer|Menc)[A-Za-zÀ-ÿ]{2,}\b/;
const HENTI_LAJUR =
  /^(?:Cadangan\s+Aktiviti|Tahap\s*Penguasaan|Standard\s+Prestasi|Standard\s+Kandungan|Tafsiran|Nota\s*:|KSSM\b|Glosari\b)/i;

/**
 * PDF jadual kadang-kadang mengeluarkan lajur kod dahulu, kemudian lajur ayat.
 * "4.4.1\n4.4.2\nMenyenarai...\nMemerihal..." dijadikan "4.4.1 Menyenarai...\n4.4.2 Memerihal...".
 */
function gandingLajurKod(text: string) {
  const lines = text.split(/\n/);
  const keluar: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const kini = lines[i]?.trim() ?? "";
    const berikut = lines[i + 1]?.trim() ?? "";
    if (!KOD_SP_SAHAJA.test(kini) || !KOD_SP_SAHAJA.test(berikut)) {
      keluar.push(lines[i] ?? "");
      i += 1;
      continue;
    }

    const kod: string[] = [];
    while (i < lines.length && KOD_SP_SAHAJA.test(lines[i]?.trim() ?? "")) {
      kod.push((lines[i] ?? "").trim());
      i += 1;
    }

    const ayat: string[] = [];
    let semasa = "";
    const tutup = () => {
      if (semasa.trim()) ayat.push(semasa.trim());
      semasa = "";
    };
    while (i < lines.length && ayat.length < kod.length) {
      const baris = lines[i]?.trim() ?? "";
      if (!baris) {
        i += 1;
        continue;
      }
      if (KOD_SP_SAHAJA.test(baris) || HENTI_LAJUR.test(baris) || /^\d+\.\d+\s+\S/.test(baris)) break;
      if (MULA_AYAT_SP.test(baris) && semasa) tutup();
      if (ayat.length >= kod.length) break;
      semasa = semasa ? `${semasa} ${baris}` : baris;
      i += 1;
      if (/[.!?]$/.test(semasa) && ayat.length + 1 >= kod.length) {
        tutup();
        break;
      }
    }
    tutup();

    const padan = Math.min(kod.length, ayat.length);
    for (let k = 0; k < padan; k += 1) keluar.push(`${kod[k]} ${ayat[k]}`);
    for (let k = padan; k < kod.length; k += 1) keluar.push(kod[k]);
  }
  return keluar.join("\n");
}

type Token = { kod: string; body: string };

function tokenize(section: string): Token[] {
  const cleaned = cleanNoise(gandingLajurKod(section));
  const joined = cleaned.replace(/\n+/g, " ");
  const tokens: Token[] = [];
  const matches = [...joined.matchAll(CODE_RE)];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const kod = kodBersih(match[1] ?? "");
    if (!kod || match.index == null || !arasKod(kod)) continue;
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

  function pastikanBidang(kod: string) {
    const sedia = bidang.find((item) => item.kod === kod);
    if (sedia) return sedia;
    const baru: BidangPembelajaran = {
      kod,
      nama: `Bidang ${kod}`,
      penerangan: null,
      jam: jamByKod.get(kod) ?? null,
      standard_kandungan: [],
    };
    bidang.push(baru);
    return baru;
  }

  for (const token of tokens) {
    if (arasKod(token.kod) === "bidang") {
      const nama = titleCaseNama(compact(token.body).split(/(?=\d+\.\d+)/)[0] ?? token.body);
      currentBidang = pastikanBidang(token.kod);
      if (nama) currentBidang.nama = nama;
      currentBidang.penerangan = peneranganByNama.get(currentBidang.nama.toLowerCase()) ?? currentBidang.penerangan;
      currentBidang.jam = jamByKod.get(token.kod) ?? currentBidang.jam;
      currentSk = null;
      continue;
    }

    if (arasKod(token.kod) === "sk") {
      currentBidang = pastikanBidang(kodBidang(token.kod));
      currentSk = currentBidang.standard_kandungan.find((item) => item.kod === token.kod) ?? null;
      if (!currentSk) {
        currentSk = {
          kod: token.kod,
          tajuk: compact(token.body) || token.kod,
          standard_pembelajaran: [],
        };
        currentBidang.standard_kandungan.push(currentSk);
      } else if (tajukLemah(currentSk.tajuk, currentSk.kod)) {
        currentSk.tajuk = compact(token.body) || currentSk.tajuk;
      }
      continue;
    }

    if (arasKod(token.kod) === "sp") {
      currentBidang = pastikanBidang(kodBidang(token.kod));
      const induk = kodSk(token.kod);
      currentSk = currentBidang.standard_kandungan.find((item) => item.kod === induk) ?? null;
      if (!currentSk) {
        currentSk = { kod: induk, tajuk: induk, standard_pembelajaran: [] };
        currentBidang.standard_kandungan.push(currentSk);
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

  return bersihkanExtractDskp({
    ...metadata,
    bidang,
    kaedah_analisis: "parser",
  });
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
