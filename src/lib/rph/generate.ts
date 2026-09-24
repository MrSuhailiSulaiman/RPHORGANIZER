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
      set_aktiviti: z.array(setKaedahSchema).min(3).max(4),
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
    nama: "Pembelajaran Koperatif (Kumpulan / Jigsaw)",
    ciri: "murid bekerjasama dalam kumpulan kecil; setiap ahli ada peranan khusus (kumpulan asal dan kumpulan pakar) dan saling bergantung untuk matlamat bersama",
  },
  {
    nama: "Pembelajaran Berasaskan Projek (Project-Based Learning)",
    ciri: "murid merancang dan menyiapkan tugasan atau produk yang boleh dipamerkan, mengaplikasi pengetahuan dalam konteks sebenar, kemudian membentangkan hasil",
  },
  {
    nama: "Pembelajaran Inkuiri (Inquiry-Based Learning)",
    ciri: "murid bermula dengan soalan atau masalah, membuat ramalan, meneroka dan menyiasat secara berpandu, kemudian membuat kesimpulan berdasarkan bukti",
  },
  {
    nama: "Kelas Terbalik (Flipped Classroom)",
    ciri: "murid meneliti bahan (video, nota, kod QR) sebelum kelas; masa kelas digunakan untuk perbincangan, latihan aplikasi, dan menjelaskan kekeliruan",
  },
  {
    nama: "Pembelajaran Kendiri (Self-Directed Learning)",
    ciri: "murid menetapkan sasaran sendiri, memilih laluan dan kadar mengikut kebolehan, serta menilai kemajuan sendiri menggunakan rubrik atau senarai semak",
  },
] as const;

export const KAEDAH_MASTERI = [
  "kuiz masteri 5 item dan rakan semak dengan senarai semak",
  "tugasan prestasi ringkas sebagai bukti penguasaan",
  "exit ticket individu kemudian peta sudah kuasai / belum",
  "demonstrasi ketua kumpulan, rakan menilai bukti penguasaan",
] as const;

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

/** Pilih satu kaedah PdP secara rawak tetapi stabil untuk biji yang sama. */
export function pilihKaedahPdP(biji: string, masteri = false) {
  if (masteri) return KAEDAH_MASTERI[hashBiji(biji) % KAEDAH_MASTERI.length];
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

/**
 * Kaedah bertukar bagi setiap kemunculan SK yang sama, dan setiap sesi ke-4 ialah semakan masteri.
 * `biji` kekal sama bagi satu kelas/SK supaya set permulaan berbeza antara kelas.
 * Langkah dalam satu set tidak dikocak kerana urutan kaedah (contoh Kelas Terbalik) mesti kekal logik.
 */
export function pilihAktivitiUntukSesi(bahan: BahanRph, indeksKemunculan: number, biji: string) {
  const masteri = bersihAktiviti(bahan.masteri);
  if ((indeksKemunculan + 1) % 4 === 0 && masteri.length) return masteri;

  const amalan = (bahan.variasi?.length ? bahan.variasi : [bahan.aktiviti])
    .map(bersihAktiviti)
    .filter((item) => item.length);
  if (!amalan.length) return bersihAktiviti(bahan.aktiviti);
  return amalan[(indeksKemunculan + hashBiji(biji)) % amalan.length];
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

function arahanAktivitiDaripadaObjektif(kaedah?: string, masteri = false) {
  const fokus = masteri
    ? `FOKUS SESI INI: SEMAKAN MASTERI berkala (${kaedah ?? KAEDAH_MASTERI[0]}). Murid menunjukkan bukti penguasaan, bukan syarahan ulang.`
    : `KAEDAH PEMBELAJARAN — pilih daripada senarai ini mengikut objektif yang anda tulis:
${senaraiKaedah()}
Cadangan kaedah untuk sesi ini: ${kaedah ?? KAEDAH_PDP[0].nama}. Jika objektif lebih sesuai dengan kaedah lain dalam senarai, gunakan kaedah itu.
Langkah pertama WAJIB menyebut nama kaedah yang dipilih, dan semua langkah mesti mencerminkan ciri kaedah itu.`;
  return `LANGKAH 3 — TULIS 5-8 aktiviti TERPERINCI yang BERPUSATKAN MURID, berpandukan objektif yang anda tulis.
${fokus}
Murid yang aktif: meneroka, menyiasat, berbincang, menyatakan contoh, menghasilkan produk, mempersembah, menilai rakan.
Guru sebagai fasilitator, BUKAN syarahan panjang. Dilarang langkah "Guru menerangkan..." sebagai aktiviti utama.
Setiap langkah 1-3 ayat: apa murid buat, dengan bahan apa, berapa item atau berapa minit, dan hasil yang dijangka.
Susunan: set induksi, aktiviti utama murid, semakan pembelajaran (semak nombor dalam objektif), penutup.
DILARANG ulang ayat, urutan, atau kaedah yang sama seperti RPH lain. Variasikan kumpulan (individu/berpasangan/4 orang), bahan, dan hasil.
Contoh baik: "Murid dalam kumpulan pakar 4 orang menyiasat 1 senario, mencatat 3 bukti pada kertas sebak, kemudian pulang ke kumpulan asal untuk mengajar rakan dalam masa 8 minit."`;
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
    aktiviti: masteri ? bersihAktiviti(output.aktiviti) : tandaKaedah(bersihAktiviti(output.aktiviti), kaedah),
  };
}

/** Bahan tanpa Gemini: tiga kaedah PdP berbeza dan satu set semakan masteri. */
export function bahanSandaran(tajuk?: string, kodSp?: string): BahanRph {
  const konsep = tajuk?.trim() || "isi pelajaran";
  const rujukan = kodSp?.trim() || konsep;
  const inkuiri = [
    `Kaedah Pembelajaran Inkuiri: murid meneliti 1 senario berkaitan ${konsep} dan menulis 2 soalan siasatan pada kertas nota.`,
    `Murid berpasangan membuat ramalan dan menyiasat 4 bukti berkaitan ${konsep} menggunakan buku teks atau bahan yang disediakan.`,
    `Setiap pasangan mencatat 3 contoh pada kertas sebak, kemudian membanding dapatan dengan pasangan lain selama 6 minit.`,
    `Perwakilan membentangkan 2 kesimpulan berdasarkan bukti manakala rakan menanda senarai semak.`,
    `Murid individu menulis 3 contoh dan 2 justifikasi pada lembaran kerja tanpa merujuk nota.`,
    `Murid menyemak nombor dalam objektif bersama rakan dan membetulkan 1 kesilapan sebelum penutup.`,
  ];
  const koperatif = [
    `Kaedah Pembelajaran Koperatif: murid dibahagi kumpulan asal 4 orang dan setiap ahli menerima 1 peranan pakar berkaitan ${konsep}.`,
    `Kumpulan pakar meneroka bahagian masing-masing selama 10 minit dan mencatat 3 isi penting.`,
    `Ahli pakar pulang ke kumpulan asal dan mengajar rakan 3 isi itu, rakan mencatat 2 soalan susulan.`,
    `Kumpulan menghasilkan 1 peta minda ${konsep} dengan 4 cabang, kemudian bertukar dengan kumpulan lain untuk 2 komen.`,
    `Setiap murid menyelesaikan cabaran 10 minit: 3 contoh dengan 2 justifikasi bertulis secara individu.`,
    `Kumpulan menilai sumbangan setiap ahli menggunakan senarai semak sebelum penutup.`,
  ];
  const kendiri = [
    `Kaedah Pembelajaran Kendiri: murid menetapkan 1 sasaran peribadi berkaitan ${konsep} dan memilih laluan latihan mengikut kebolehan.`,
    `Murid memilih 1 daripada 3 tugasan berbeza aras dan menyiapkannya dalam masa 12 minit.`,
    `Murid menggunakan rubrik untuk menilai hasil sendiri dan menanda 3 kriteria yang sudah dicapai.`,
    `Murid berpasangan bertukar hasil dan memberi 2 komen pembaikan yang khusus.`,
    `Murid membaiki hasil berdasarkan komen rakan, kemudian menulis 2 justifikasi akhir.`,
    `Murid mencatat 1 langkah susulan untuk sesi akan datang pada jurnal pembelajaran sebelum penutup.`,
  ];
  const masteri = [
    `Semakan masteri: murid menanda sendiri tahap penguasaan ${konsep} (sudah kuasai / belum) pada kad exit.`,
    `Murid individu menjawab kuiz masteri 5 item berkaitan ${konsep} dalam masa 8 minit tanpa nota.`,
    `Rakan semak menukar kertas dan menanda 5 item menggunakan senarai semak bukti penguasaan.`,
    `Murid yang belum kuasai mengulang 3 contoh dengan bantuan rakan, yang sudah kuasai menambah 2 senario baharu.`,
    `Perwakilan mendemonstrasikan 1 tugasan prestasi ${konsep} selama 2 minit sebagai bukti penguasaan.`,
    `Murid mengemaskini peta masteri (sudah/belum) dan menulis 1 langkah susulan sebelum penutup.`,
  ];
  return {
    objektif: [
      `Murid dapat menyatakan 3 contoh berkaitan ${rujukan} secara bertulis pada lembaran kerja individu berdasarkan 1 senario yang diberi, dengan 2 justifikasi yang tepat.`,
      `Murid dapat menyenaraikan 4 isi utama berkaitan ${rujukan} dalam kumpulan dalam masa 10 minit, kemudian membentangkan sekurang-kurangnya 2 hujah yang logik.`,
    ],
    bbm: "Buku teks, lembaran kerja, kertas sebak, pen marker, kad soalan, rubrik, projektor LCD",
    nilai: "PEMIKIR",
    aktiviti: inkuiri,
    variasi: [inkuiri, koperatif, kendiri],
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

function petaDariGemini(item: {
  sk_kod: string;
  objektif: string[];
  bbm: string;
  nilai: string;
  set_aktiviti: { kaedah: string; aktiviti: string[] }[];
  aktiviti_masteri: string[];
}): BahanRph {
  const variasi = item.set_aktiviti
    .map((set) => tandaKaedah(bersihAktiviti(set.aktiviti), set.kaedah ?? ""))
    .filter((senarai) => senarai.length);
  const masteri = bersihAktiviti(item.aktiviti_masteri);
  return {
    objektif: item.objektif.filter(Boolean).slice(0, 3),
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
3. set_aktiviti: 3 set aktiviti untuk sesi PdP yang BERBEZA. Setiap set:
   - kaedah: pilih SATU kaedah daripada senarai kaedah di bawah yang PALING SESUAI dengan objektif. Setiap set WAJIB kaedah berbeza.
   - aktiviti: 5-8 langkah berpusatkan murid yang benar-benar mencerminkan ciri kaedah itu.
   Dilarang salin ayat, urutan, bahan, atau bentuk hasil merentas set.
4. aktiviti_masteri: semakan masteri BERKALA (kuiz 5 item, exit ticket, tugasan prestasi, rakan semak bukti penguasaan).
5. bbm dan nilai.

${arahanObjektifDaripadaSp()}

${arahanAktivitiDaripadaObjektif("kaedah berbeza bagi setiap set", false)}

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
        const bahan = petaDariGemini(item);
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
