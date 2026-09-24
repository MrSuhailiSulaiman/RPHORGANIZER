import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { geminiApiKey } from "@/lib/runtime-env";
import type { KurikulumPilihan } from "./types";
import { kunciUnit, type UnitKurikulum } from "./tahun";

export type BahanRph = {
  objektif: string[];
  bbm: string;
  nilai: string;
  aktiviti: string[];
  variasi?: string[][];
  masteri?: string[];
};

const ayatObjektifSesi = z
  .string()
  .min(80)
  .max(500)
  .refine((ayat) => (ayat.match(/\d+/g) ?? []).length >= 2, {
    message: "Objektif mesti ada sekurang-kurangnya dua nombor yang boleh diukur",
  })
  .refine((ayat) => !/^Murid dapat menerangkan [^0-9]+$/i.test(ayat.trim()), {
    message: "Jangan salin ayat standard pembelajaran",
  });

const ayatAktiviti = z.string().min(50).max(500);
const senaraiAktiviti = z.array(ayatAktiviti).min(5).max(8);

const setKaedahSchema = z.object({
  kaedah: z.string(),
  aktiviti: senaraiAktiviti,
});

const bahanSchema = z.object({
  bahan: z.array(
    z.object({
      sk_kod: z.string(),
      objektif: z.array(ayatObjektifSesi).min(2).max(3),
      bbm: z.string(),
      nilai: z.string(),
      set_aktiviti: z.array(setKaedahSchema).min(4).max(4),
      aktiviti_masteri: senaraiAktiviti,
    })
  ),
});

const sesiSchema = z.object({
  objektif: z.array(ayatObjektifSesi).min(2).max(3),
  bbm: z.string(),
  nilai: z.string(),
  aktiviti: senaraiAktiviti,
});

const objektifSahajaSchema = z.object({
  objektif: z.array(ayatObjektifSesi).min(2).max(3),
});

const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
] as const;

export const KAEDAH_PDP = [
  {
    nama: "Pembelajaran Koperatif",
    ciri: "murid bekerjasama dalam kumpulan kecil; setiap ahli ada peranan khusus dan saling bergantung untuk mencapai kriteria dalam objektif",
  },
  {
    nama: "Pembelajaran Berasaskan Masalah",
    ciri: "murid menerima satu masalah atau senario, menganalisis punca, mencadang penyelesaian, dan menilai sama ada penyelesaian itu memenuhi kriteria objektif",
  },
  {
    nama: "Pembelajaran Inkuiri",
    ciri: "murid bermula dengan soalan siasatan, membuat ramalan, mengumpul bukti, kemudian membuat kesimpulan yang memenuhi bilangan dalam objektif",
  },
  {
    nama: "Pembelajaran Berasaskan Projek",
    ciri: "murid merancang dan menyiapkan satu produk yang mempamerkan kriteria objektif, kemudian membentangkan hasil",
  },
] as const;

export const KAEDAH_MASTERI = "Pembelajaran Masteri";

function googleModel(nama: string, apiKey = geminiApiKey()) {
  return createGoogleGenerativeAI({ apiKey })(nama);
}

function bolehCubaModelLain(error: unknown) {
  const mesej = error instanceof Error ? error.message : String(error);
  return /high demand|no longer available|not found|not supported|404|unavailable|quota|rate[- ]limit|429|resource exhausted|overloaded/i.test(
    mesej
  );
}

async function janaObjek<T>(
  schema: z.ZodType<T>,
  prompt: string,
  apiKey?: string,
  signal?: AbortSignal
): Promise<T> {
  const kunci = apiKey || geminiApiKey();
  let last: unknown;
  for (const nama of GEMINI_MODELS) {
    if (signal?.aborted) break;
    try {
      const { output } = await generateText({
        model: googleModel(nama, kunci),
        output: Output.object({ schema }),
        prompt,
        temperature: 0.9,
        maxRetries: 0,
        abortSignal: signal,
      });
      if (output) return output;
    } catch (error) {
      last = error;
      console.error("gemini_model", nama, error instanceof Error ? error.message : error);
      if (!bolehCubaModelLain(error)) throw error;
    }
  }
  throw last instanceof Error ? last : new Error("Gemini gagal menjana kandungan RPH.");
}

export function hasGeminiKey() {
  return Boolean(geminiApiKey());
}

function senaraiSp(sp: { kod: string; pernyataan: string }[]) {
  return sp.map((item) => `- ${item.kod} ${item.pernyataan}`.trim()).join("\n");
}

function hashBiji(teks: string) {
  let hash = 2166136261;
  for (let i = 0; i < teks.length; i += 1) {
    hash ^= teks.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function bersihAktiviti(senarai: string[] | undefined) {
  return (senarai ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

/** Pilih satu kaedah PdP secara stabil untuk biji yang sama. */
export function pilihKaedahPdP(biji: string, masteri = false) {
  if (masteri) return KAEDAH_MASTERI;
  return KAEDAH_PDP[hashBiji(biji) % KAEDAH_PDP.length].nama;
}

function namaRingkasKaedah(kaedah: string) {
  return kaedah.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Namakan kaedah pada langkah pertama supaya guru nampak kaedah yang digunakan. */
function tandaKaedah(aktiviti: string[], kaedah: string) {
  const nama = namaRingkasKaedah(kaedah);
  if (!aktiviti.length || !nama) return aktiviti;
  const [pertama, ...lain] = aktiviti;
  if (pertama.toLowerCase().includes(nama.toLowerCase())) return aktiviti;
  return [`Kaedah ${nama}: ${pertama}`, ...lain];
}

function nomborUkuran(ayat: string) {
  return ayat.match(/(?<![.\d])\d+(?![.\d])/g) ?? [];
}

/** Pastikan sekurang-kurangnya satu langkah menyemak nombor dan kod dalam objektif. */
export function ikatAktivitiPadaObjektif(objektif: string[], aktiviti: string[]) {
  const langkah = bersihAktiviti(aktiviti);
  const sasaran = objektif.map((item) => item.trim()).filter(Boolean);
  if (!langkah.length || !sasaran.length) return langkah;
  const nombor = [...new Set(sasaran.flatMap(nomborUkuran))];
  const kod = [...new Set(sasaran.flatMap((ayat) => ayat.match(/\d+(?:\.\d+)+/g) ?? []))];
  const teks = langkah.join(" ");
  const adaNombor = !nombor.length || nombor.some((item) => nomborUkuran(teks).includes(item));
  const adaKod = !kod.length || kod.some((item) => teks.includes(item));
  if (adaNombor && adaKod) return langkah;
  const semakan = sasaran[0].replace(/\s+/g, " ");
  const penutup = `Murid menyemak hasil supaya selari dengan objektif: ${semakan}`;
  return [...langkah.slice(0, 7), penutup];
}

/**
 * Lima kaedah dipusing secara sekata merentas RPH yang berbeza.
 * `biji` menukar kaedah permulaan antara kelas supaya jadual tidak serupa.
 */
export function pilihAktivitiUntukSesi(bahan: BahanRph, indeksKemunculan: number, biji: string) {
  const amalan = (bahan.variasi?.length ? bahan.variasi : [bahan.aktiviti])
    .map(bersihAktiviti)
    .filter((item) => item.length);
  const masteri = bersihAktiviti(bahan.masteri);
  const semua = masteri.length ? [...amalan, masteri] : amalan;
  if (!semua.length) return ikatAktivitiPadaObjektif(bahan.objektif, bahan.aktiviti);
  const offset = hashBiji(biji) % semua.length;
  return ikatAktivitiPadaObjektif(bahan.objektif, semua[(indeksKemunculan + offset) % semua.length]);
}

function arahanObjektifDaripadaSp(sp?: { kod: string; pernyataan: string }[]) {
  const terpilih = (sp ?? []).filter((item) => item.kod.trim());
  const contoh = terpilih[0];
  const kod = terpilih.map((item) => item.kod.trim());
  const contohKod = contoh?.kod.trim() || "KOD";
  const contohAyat = contoh?.pernyataan.trim() || "pernyataan Standard Pembelajaran dalam data";
  const rujukan = kod.length
    ? kod.join(", ")
    : "kod Standard Pembelajaran yang diberi dalam data. Jangan cipta kod baharu dan jangan salin perkataan KOD";
  return `LANGKAH 1 — ANALISIS setiap Standard Pembelajaran. Jangan salin ayatnya.
Untuk setiap SP pecahkan: kod, kata kerja DSKP, konsep yang mesti dikuasai, dan bukti yang boleh dikira dalam SATU sesi PdP.

LANGKAH 2 — TULIS 2-3 objektif yang MENGOPERASIKAN hasil analisis itu.
Setiap objektif SATU ayat panjang bermula "Murid dapat ...".

WAJIB RUJUK STANDARD PEMBELAJARAN:
- Setiap objektif mesti menyebut kod SP yang dirujuk, disalin tepat: ${rujukan}.
- Letakkan kod itu dalam frasa "berkaitan ${contohKod}".
- Jika lebih daripada satu SP dipilih, setiap objektif menyebut kod SP yang dioperasikannya. Semua kod terpilih mesti muncul sekurang-kurangnya sekali.
- Jangan salin ayat penuh SP. Sebut kod, kemudian tulis tingkah laku murid yang boleh diukur.

DILARANG:
- "Murid dapat " diikuti ayat Standard Pembelajaran (contoh dilarang: "Murid dapat ${contohAyat}").
- Objektif yang tidak mengandungi kod SP.
- Kata kerja kabur: memahami, mengetahui, menghayati, menyedari, menghargai.
- Perkataan: beberapa, pelbagai, sesuai.

WAJIB dalam SETIAP objektif — sekurang-kurangnya DUA nombor Arab yang guru boleh semak ya/tidak, selain kod SP:
- menyatakan / memberi contoh → berapa contoh (contoh 3)
- menyenaraikan → berapa perkara (contoh 4) + berapa senario/justifikasi
- membandingkan → berapa perbezaan (contoh 3) + masa atau bilangan hujah
- menulis/menghasilkan → berapa langkah/ayat + kriteria ketepatan
- membentangkan → berapa isi atau berapa minit

GAYA YANG WAJIB DIIKUTI untuk "${contohKod} ${contohAyat}":
"Murid dapat menyatakan 3 contoh berkaitan ${contohKod} secara bertulis berdasarkan 1 senario atur cara, dengan 2 justifikasi yang tepat."
"Murid dapat menyenaraikan 4 keperluan berkaitan ${contohKod} berdasarkan 1 senario, dengan 2 justifikasi yang tepat."
"Murid dapat membandingkan 3 perbezaan berkaitan ${contohKod} dalam masa 10 minit, dengan sekurang-kurangnya 2 hujah yang logik."`;
}

function adaKodSp(ayat: string, kod: string) {
  const escaped = kod.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![0-9.])${escaped}(?![0-9.])`).test(ayat);
}

function sisipKodSp(ayat: string, kod: string) {
  if (adaKodSp(ayat, kod)) return ayat;
  if (/\bberkaitan\b/i.test(ayat)) return ayat.replace(/\bberkaitan\b/i, `berkaitan ${kod}`);
  const berdasar = ayat.search(/\bberdasarkan\b/i);
  if (berdasar >= 0) return `${ayat.slice(0, berdasar)}berkaitan ${kod} ${ayat.slice(berdasar)}`;
  const padanan = ayat.match(/^(Murid dapat\s+\S+(?:\s+\d+)?(?:\s+\S+)?)/i);
  if (padanan) return `${padanan[1]} berkaitan ${kod}${ayat.slice(padanan[1].length)}`;
  return `${ayat.replace(/\.\s*$/, "")} berkaitan ${kod}.`;
}

/** Pastikan setiap objektif menyebut kod Standard Pembelajaran yang dipilih. */
export function pastikanKodDalamObjektif(objektif: string[], sp: { kod: string }[]) {
  const kod = [...new Set(sp.map((item) => item.kod.trim()).filter(Boolean))];
  const hasil = objektif.map((item) => item.trim()).filter(Boolean).slice(0, 3);
  if (!kod.length || !hasil.length) return hasil;
  const belum = kod.filter((item) => !hasil.some((ayat) => adaKodSp(ayat, item)));
  return hasil.map((ayat, indeks) => {
    if (kod.some((item) => adaKodSp(ayat, item))) return ayat;
    const sasaran = belum.shift() ?? kod[Math.min(indeks, kod.length - 1)];
    return sisipKodSp(ayat, sasaran);
  });
}

function senaraiKaedah() {
  return KAEDAH_PDP.map((item) => `- ${item.nama}: ${item.ciri}`).join("\n");
}

function arahanSelariObjektif() {
  return `SELARI DENGAN OBJEKTIF — WAJIB:
- Tulis objektif dahulu. Setiap langkah aktiviti melaksanakan objektif itu, bukan tugasan lain.
- Setiap objektif mesti ada sekurang-kurangnya satu langkah yang melaksanakannya.
- Kod SP dalam aktiviti mesti sama dengan kod dalam objektif. Jika objektif menyebut "berkaitan 3.2.1", aktiviti juga menyebut 3.2.1.
- Nombor ukuran mesti sama. Jika objektif minta 3 contoh dan 2 justifikasi, aktiviti minta 3 contoh dan 2 justifikasi. Jangan cipta bilangan baharu.
- Langkah semakan menyemak kriteria objektif (bilangan, masa, justifikasi) supaya guru boleh tanda ya atau tidak.
- Dilarang kemahiran atau hasil yang tidak ditulis dalam objektif.`;
}

function arahanAktivitiDaripadaObjektif(kaedah?: string, masteri = false) {
  const nama = masteri ? KAEDAH_MASTERI : (kaedah ?? KAEDAH_PDP[0].nama);
  const ciri = KAEDAH_PDP.find((item) => item.nama === nama)?.ciri
    ?? "murid membuktikan penguasaan kriteria objektif melalui kuiz, tugasan prestasi, atau semakan rakan, kemudian menanda sudah kuasai atau belum";
  return `LANGKAH 3 — TULIS 5-8 aktiviti TERPERINCI yang BERPUSATKAN MURID.
KAEDAH SESI INI DIKUNCI: ${nama}. Jangan tukar kaedah.
Ciri: ${ciri}
Langkah pertama WAJIB bermula "Kaedah ${nama}:".
${arahanSelariObjektif()}
Murid yang aktif. Guru sebagai fasilitator. Dilarang langkah "Guru menerangkan..." sebagai aktiviti utama.
Setiap langkah 1-3 ayat: apa murid buat, bahan, bilangan yang sama dengan objektif, dan hasil.
Susunan: set induksi, aktiviti utama murid, semakan objektif, penutup.`;
}

type KonteksSesi = {
  mata_pelajaran: string;
  tingkatan: string;
  kelas: string;
  hari: string;
  masa: string;
  bidang_nama: string;
  sk_kod: string;
  sk_tajuk: string;
  standard_pembelajaran: { kod: string; pernyataan: string }[];
  kaedah?: string;
  masteri?: boolean;
};

function tapisSp(input: KonteksSesi, apiKey?: string) {
  const sp = input.standard_pembelajaran.filter((item) => item.pernyataan.trim());
  if (!sp.length) throw new Error("Pilih standard pembelajaran dahulu.");
  if (!(apiKey || hasGeminiKey())) throw new Error("Kunci Gemini belum dikonfigurasi.");
  return sp;
}

function promptKonteksSesi(input: KonteksSesi, sp: { kod: string; pernyataan: string }[]) {
  return `Anda guru pakar KSSM Malaysia. Tulis dalam bahasa Melayu standard sekolah.

Konteks sesi:
- Mata pelajaran: ${input.mata_pelajaran || "-"}
- Tingkatan: ${input.tingkatan || "-"}
- Kelas: ${input.kelas || "-"}
- Hari: ${input.hari || "-"}
- Masa: ${input.masa || "-"}
- Bidang pembelajaran: ${input.bidang_nama || "-"}
- Standard kandungan: ${[input.sk_kod, input.sk_tajuk].filter(Boolean).join(" ") || "-"}

Standard Pembelajaran yang mesti dianalisis (jangan cipta kod baharu):
${senaraiSp(sp)}

${arahanObjektifDaripadaSp(sp)}`;
}

export async function janaObjektifSesi(input: KonteksSesi, apiKey?: string): Promise<string[]> {
  const sp = tapisSp(input, apiKey);
  const output = await janaObjek(
    objektifSahajaSchema,
    `${promptKonteksSesi(input, sp)}

Hasilkan HANYA medan objektif. Setiap objektif mesti menyebut kod Standard Pembelajaran dalam frasa "berkaitan {kod}" dan lahir daripada analisis SP, bukan salinan ayat SP.`,
    apiKey
  );
  if (!output?.objektif?.length) throw new Error("Gemini tidak menghasilkan objektif.");
  return pastikanKodDalamObjektif(output.objektif, sp);
}

export async function janaBahanSesi(input: KonteksSesi, apiKey?: string): Promise<BahanRph> {
  const sp = tapisSp(input, apiKey);
  const biji = [input.mata_pelajaran, input.kelas, input.hari, input.masa, input.sk_kod, String(Date.now())].join("|");
  const masteri = Boolean(input.masteri);
  const kaedah = input.kaedah?.trim() || pilihKaedahPdP(biji, masteri);
  const output = await janaObjek(
    sesiSchema,
    `${promptKonteksSesi(input, sp)}

${arahanAktivitiDaripadaObjektif(kaedah, masteri)}

Tugas tambahan:
1. objektif: ikut arahan analisis di atas.
2. aktiviti: 5-8 langkah yang benar-benar mencerminkan kaedah pembelajaran yang dipilih.
3. bbm: bahan realistik di sekolah Malaysia, sepadan dengan kaedah itu.
4. nilai: satu nilai murni KSSM (contoh PEMIKIR, PRIHATIN, AMANAH).

Jangan ulang ayat standard pembelajaran sebagai aktiviti.`,
    apiKey
  );

  if (!output) throw new Error("Gemini tidak menghasilkan objektif dan aktiviti.");
  return {
    objektif: pastikanKodDalamObjektif(output.objektif, sp),
    bbm: output.bbm.trim(),
    nilai: (output.nilai || "PEMIKIR").trim(),
    aktiviti: ikatAktivitiPadaObjektif(
      pastikanKodDalamObjektif(output.objektif, sp),
      masteri ? bersihAktiviti(output.aktiviti) : tandaKaedah(bersihAktiviti(output.aktiviti), kaedah)
    ),
  };
}

/** Bahan tanpa Gemini: empat kaedah PdP dan satu set Pembelajaran Masteri, selari dengan objektif. */
export function bahanSandaran(tajuk?: string, kodSp?: string): BahanRph {
  const konsep = tajuk?.trim() || "isi pelajaran";
  const rujukan = kodSp?.trim() || konsep;
  const inkuiri = [
    `Kaedah Pembelajaran Inkuiri: murid meneliti 1 senario berkaitan ${rujukan} dan menulis 2 soalan siasatan pada kertas nota.`,
    `Murid berpasangan membuat ramalan dan menyiasat 4 bukti berkaitan ${rujukan} menggunakan buku teks atau bahan yang disediakan.`,
    `Setiap pasangan mencatat 3 contoh berkaitan ${rujukan} pada kertas sebak, kemudian membanding dapatan dengan pasangan lain.`,
    `Perwakilan membentangkan 2 justifikasi berdasarkan bukti manakala rakan menanda senarai semak.`,
    `Murid individu menulis 3 contoh berkaitan ${rujukan} dan 2 justifikasi pada lembaran kerja tanpa merujuk nota.`,
    `Murid menyemak hasil supaya selari dengan objektif: 3 contoh, 4 bukti, dan 2 justifikasi berkaitan ${rujukan}.`,
  ];
  const koperatif = [
    `Kaedah Pembelajaran Koperatif: murid dibahagi kumpulan asal 4 orang dan setiap ahli menerima 1 peranan pakar berkaitan ${rujukan}.`,
    `Kumpulan pakar meneroka bahagian masing-masing selama 10 minit dan mencatat 4 isi berkaitan ${rujukan}.`,
    `Ahli pakar pulang ke kumpulan asal dan mengajar rakan 3 contoh berkaitan ${rujukan}, rakan mencatat 2 justifikasi.`,
    `Kumpulan menghasilkan 1 peta minda berkaitan ${rujukan} dengan 4 cabang, kemudian bertukar dengan kumpulan lain untuk 2 komen.`,
    `Setiap murid menulis 3 contoh berkaitan ${rujukan} dengan 2 justifikasi secara individu dalam masa 10 minit.`,
    `Murid menyemak hasil supaya selari dengan objektif: 3 contoh, 4 isi, dan 2 justifikasi berkaitan ${rujukan}.`,
  ];
  const masalah = [
    `Kaedah Pembelajaran Berasaskan Masalah: murid menerima 1 senario berkaitan ${rujukan} dan mengenal pasti 3 maklumat penting serta 2 kekangan.`,
    `Kumpulan 4 orang menganalisis punca masalah berkaitan ${rujukan} dan mencatat 4 isi pada kertas sebak.`,
    `Setiap kumpulan mencadang 1 penyelesaian yang mengandungi 3 contoh berkaitan ${rujukan} dengan 2 justifikasi.`,
    `Kumpulan lain menilai cadangan itu menggunakan senarai semak 3 contoh dan 2 justifikasi, kemudian memberi 2 komen.`,
    `Murid individu menulis semula 3 contoh berkaitan ${rujukan} dan 2 justifikasi pada lembaran kerja.`,
    `Murid menyemak hasil supaya selari dengan objektif: 3 contoh, 4 isi, dan 2 justifikasi berkaitan ${rujukan}.`,
  ];
  const projek = [
    `Kaedah Pembelajaran Berasaskan Projek: murid dalam kumpulan 4 orang merancang 1 produk berkaitan ${rujukan} yang memuatkan 4 isi utama.`,
    `Setiap ahli menyumbang 3 contoh berkaitan ${rujukan} dan kumpulan memilih contoh yang disokong 2 justifikasi.`,
    `Kumpulan menyiapkan produk pada kertas sebak dalam masa 10 minit dengan 4 cabang isi berkaitan ${rujukan}.`,
    `Perwakilan membentangkan 4 isi dan 2 justifikasi berkaitan ${rujukan} manakala rakan menanda senarai semak.`,
    `Murid individu menulis 3 contoh berkaitan ${rujukan} yang dipelajari daripada projek, dengan 2 justifikasi.`,
    `Murid menyemak produk supaya selari dengan objektif: 3 contoh, 4 isi, dan 2 justifikasi berkaitan ${rujukan}.`,
  ];
  const masteri = [
    `Kaedah Pembelajaran Masteri: murid menanda sendiri tahap penguasaan berkaitan ${rujukan} (sudah kuasai / belum) pada kad exit.`,
    `Murid individu menjawab kuiz masteri: 3 contoh berkaitan ${rujukan} dan 2 justifikasi dalam masa 8 minit tanpa nota.`,
    `Rakan semak menukar kertas dan menanda 3 contoh serta 2 justifikasi menggunakan senarai semak bukti penguasaan.`,
    `Murid yang belum kuasai mengulang 3 contoh berkaitan ${rujukan} dengan bantuan rakan, yang sudah kuasai menambah 2 senario.`,
    `Perwakilan mendemonstrasikan 4 isi berkaitan ${rujukan} selama 2 minit sebagai bukti penguasaan.`,
    `Murid mengemaskini peta masteri dan menyemak hasil supaya selari dengan objektif berkaitan ${rujukan}.`,
  ];
  return {
    objektif: [
      `Murid dapat menyatakan 3 contoh berkaitan ${rujukan} secara bertulis pada lembaran kerja individu berdasarkan 1 senario yang diberi, dengan 2 justifikasi yang tepat.`,
      `Murid dapat menyenaraikan 4 isi utama berkaitan ${rujukan} dalam kumpulan dalam masa 10 minit, kemudian membentangkan sekurang-kurangnya 2 hujah yang logik.`,
    ],
    bbm: "Buku teks, lembaran kerja, kertas sebak, pen marker, kad soalan, rubrik, projektor LCD",
    nilai: "PEMIKIR",
    aktiviti: koperatif,
    variasi: [koperatif, masalah, inkuiri, projek],
    masteri,
  };
}

function bahanAsal(unit: UnitKurikulum): BahanRph {
  const kod = unit.standard_pembelajaran
    .map((item) => item.kod.trim())
    .filter(Boolean)
    .join(", ");
  return bahanSandaran(unit.sk_tajuk || unit.sk_kod, kod);
}

/** Gemini kadangkala balas "1.1 Strategi ..." untuk sk_kod "1.1"; padankan semula ke kod yang sah. */
function padanKunciUnit(kod: string, sah: string[]) {
  const tepat = padanSkKod(kod, sah);
  if (tepat) return tepat;
  const bersih = kod.trim();
  return sah.find((calon) => calon.split("+").includes(bersih)) ?? "";
}

function padanSkKod(kod: string, sah: string[]) {
  const bersih = kod.trim();
  if (!bersih) return "";
  const tepat = sah.find((calon) => calon.toLowerCase() === bersih.toLowerCase());
  if (tepat) return tepat;
  // "1.1 Strategi ..." → "1.1"; kod SP "1.1.1" → SK induk "1.1".
  let awalan = bersih.match(/^\d+(?:\.\d+)*/)?.[0] ?? "";
  while (awalan) {
    const ikutAwalan = sah.find((calon) => calon === awalan || calon.startsWith(`${awalan} `));
    if (ikutAwalan) return ikutAwalan;
    if (!awalan.includes(".")) break;
    awalan = awalan.slice(0, awalan.lastIndexOf("."));
  }
  return sah.find((calon) => bersih.toLowerCase().startsWith(`${calon.toLowerCase()} `)) ?? "";
}

function kenalKaedah(teks: string) {
  const nilai = teks.toLowerCase();
  if (nilai.includes("koperatif")) return "Pembelajaran Koperatif";
  if (nilai.includes("masalah")) return "Pembelajaran Berasaskan Masalah";
  if (nilai.includes("inkuiri")) return "Pembelajaran Inkuiri";
  if (nilai.includes("projek")) return "Pembelajaran Berasaskan Projek";
  if (nilai.includes("masteri")) return KAEDAH_MASTERI;
  return "";
}

function petaDariGemini(item: {
  sk_kod: string;
  objektif: string[];
  bbm: string;
  nilai: string;
  set_aktiviti: { kaedah: string; aktiviti: string[] }[];
  aktiviti_masteri: string[];
}, sandaran: BahanRph): BahanRph {
  const olehNama = new Map<string, string[]>();
  for (const set of item.set_aktiviti) {
    const nama = kenalKaedah(set.kaedah) || kenalKaedah(set.aktiviti.join(" "));
    const langkah = tandaKaedah(bersihAktiviti(set.aktiviti), nama || set.kaedah);
    if (nama && langkah.length && !olehNama.has(nama)) olehNama.set(nama, langkah);
  }
  const objektif = item.objektif.filter(Boolean).slice(0, 3);
  const variasi = KAEDAH_PDP.map((kaedah, indeks) =>
    ikatAktivitiPadaObjektif(objektif, olehNama.get(kaedah.nama) ?? sandaran.variasi?.[indeks] ?? [])
  ).filter((senarai) => senarai.length);
  const masteri = ikatAktivitiPadaObjektif(
    objektif,
    tandaKaedah(bersihAktiviti(item.aktiviti_masteri), KAEDAH_MASTERI).length
      ? tandaKaedah(bersihAktiviti(item.aktiviti_masteri), KAEDAH_MASTERI)
      : sandaran.masteri ?? []
  );
  return {
    objektif,
    bbm: item.bbm,
    nilai: item.nilai || "PEMIKIR",
    aktiviti: variasi[0] ?? [],
    variasi,
    masteri,
  };
}

export async function janaBahanKurikulum(
  kurikulum: KurikulumPilihan,
  unitTugasan?: UnitKurikulum[],
  signal?: AbortSignal
) {
  const unitList = unitTugasan?.length ? unitTugasan : [];
  const peta = new Map<string, BahanRph>();
  for (const unit of unitList) peta.set(kunciUnit(unit), bahanAsal(unit));
  if (!unitList.length || !hasGeminiKey()) return peta;

  const ringkas = unitList.map((unit) => ({
    sk_kod: kunciUnit(unit),
    sk_tajuk: unit.sk_tajuk,
    bidang: unit.bidang_nama,
    standard_pembelajaran: unit.standard_pembelajaran.map((item) => ({
      kod: item.kod,
      pernyataan: item.pernyataan,
    })),
  }));

  const saiz = 4;
  const bahagianSemua: typeof ringkas[] = [];
  for (let i = 0; i < ringkas.length; i += saiz) bahagianSemua.push(ringkas.slice(i, i + saiz));
  let cursor = 0;

  async function janaBahagian() {
    while (cursor < bahagianSemua.length && !signal?.aborted) {
      const bahagian = bahagianSemua[cursor];
      cursor += 1;
      try {
        const output = await janaObjek(
          bahanSchema,
          `Anda guru pakar KSSM Malaysia. ANALISIS Standard Pembelajaran yang disenaraikan, kemudian tulis kandungan RPH untuk SETIAP sesi dalam bahasa Melayu standard sekolah.

Mata pelajaran: ${kurikulum.mata_pelajaran}
Tingkatan: ${kurikulum.tingkatan ?? "-"}

Setiap item ialah SATU sesi PdP. Medan sk_kod ialah pengecam sesi: salin tepat, jangan ubah.
Objektif dan aktiviti mesti merujuk HANYA Standard Pembelajaran dalam item itu. Setiap kod SP dalam item mesti muncul.

Untuk SETIAP sk_kod:
1. ANALISIS setiap Standard Pembelajaran dalam item. Jangan salin ayat SP.
2. objektif: 2-3 ayat TERPERINCI yang BOLEH DIUKUR. Setiap ayat satu kalimat penuh, sekurang-kurangnya 20 patah perkataan.
3. set_aktiviti: TEPAT 4 set, satu kaedah setiap set, mengikut turutan ini:
   1) Pembelajaran Koperatif
   2) Pembelajaran Berasaskan Masalah
   3) Pembelajaran Inkuiri
   4) Pembelajaran Berasaskan Projek
   Medan kaedah mesti menyalin nama itu tepat. Setiap set 5-8 langkah yang mencerminkan ciri kaedah itu.
   Dilarang ulang kaedah, ayat, urutan, atau bentuk hasil merentas set.
4. aktiviti_masteri: kaedah Pembelajaran Masteri. Murid membuktikan kriteria objektif, bukan syarahan ulang.
5. bbm dan nilai.

Kaedah yang dibenarkan:
${senaraiKaedah()}
- ${KAEDAH_MASTERI}: murid membuktikan penguasaan kriteria objektif, kemudian menanda sudah kuasai atau belum.

${arahanObjektifDaripadaSp()}

${arahanSelariObjektif()}

Jangan cipta kod baharu. Padankan sk_kod dengan tepat.

${JSON.stringify(bahagian, null, 2)}`,
          undefined,
          signal
        );
      const kodSah = bahagian.map((item) => item.sk_kod);
      for (const item of output?.bahan ?? []) {
        const kunci = padanKunciUnit(item.sk_kod, kodSah);
        if (!kunci) {
          console.error("janaBahanKurikulum_sk_tidak_padan", item.sk_kod);
          continue;
        }
        const unit = unitList.find((calon) => kunciUnit(calon) === kunci);
        const sandaranUnit = unit
          ? bahanAsal(unit)
          : bahanSandaran(item.sk_kod);
        const bahan = petaDariGemini(item, sandaranUnit);
        if (unit) bahan.objektif = pastikanKodDalamObjektif(bahan.objektif, unit.standard_pembelajaran);
        peta.set(kunci, bahan);
      }
      } catch (error) {
        console.error("janaBahanKurikulum", error);
      }
    }
  }

  await Promise.all([janaBahagian(), janaBahagian(), janaBahagian()]);

  return peta;
}
