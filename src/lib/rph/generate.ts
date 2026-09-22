import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { geminiApiKey } from "@/lib/runtime-env";
import type { KurikulumPilihan } from "./types";
import { ratakanKurikulum, type UnitKurikulum } from "./tahun";

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
  .min(130)
  .max(500)
  .refine((ayat) => (ayat.match(/\d+/g) ?? []).length >= 2, {
    message: "Objektif mesti ada sekurang-kurangnya dua nombor yang boleh diukur",
  })
  .refine((ayat) => !/^Murid dapat menerangkan [^0-9]+$/i.test(ayat.trim()), {
    message: "Jangan salin ayat standard pembelajaran",
  });

const ayatAktiviti = z.string().min(50).max(500);
const senaraiAktiviti = z.array(ayatAktiviti).min(5).max(8);

const bahanSchema = z.object({
  bahan: z.array(
    z.object({
      sk_kod: z.string(),
      objektif: z.array(ayatObjektifSesi).min(2).max(3),
      bbm: z.string(),
      nilai: z.string(),
      aktiviti_penerokaan: senaraiAktiviti,
      aktiviti_aplikasi: senaraiAktiviti,
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

export const GAYA_PDP = [
  "think-pair-share dan kertas sebak",
  "tiga stesen pembelajaran (penerokaan, latihan, semakan)",
  "jigsaw: kumpulan asal dan kumpulan pakar",
  "gallery walk dan komen rakan",
  "permainan kuiz berpasukan dengan kad soalan",
  "demonstrasi murid kemudian rakan ajar (peer teaching)",
  "peta minda kumpulan kemudian bentangan 2 minit",
  "simulasi senario dan role-play ringkas",
  "cabaran masa 10 minit menghasilkan artefak",
  "sembang sembang (shoulder partner) kemudian lapor 1 isi",
] as const;

export const GAYA_MASTERI = [
  "kuiz masteri 5 item dan rakan semak dengan senarai semak",
  "tugasan prestasi ringkas sebagai bukti penguasaan",
  "exit ticket individu kemudian peta sudah kuasai / belum",
  "demonstrasi ketua kumpulan, rakan menilai bukti penguasaan",
] as const;

function googleModel(nama: string) {
  return createGoogleGenerativeAI({ apiKey: geminiApiKey() })(nama);
}

function bolehCubaModelLain(error: unknown) {
  const mesej = error instanceof Error ? error.message : String(error);
  return /high demand|no longer available|not found|not supported|404|unavailable|quota|rate[- ]limit|429|resource exhausted|overloaded/i.test(
    mesej
  );
}

async function janaObjek<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
  let last: unknown;
  for (const nama of GEMINI_MODELS) {
    try {
      const { output } = await generateText({
        model: googleModel(nama),
        output: Output.object({ schema }),
        prompt,
        temperature: 0.9,
        maxRetries: 1,
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

function kocak<T>(senarai: T[], biji: string) {
  const salinan = [...senarai];
  let keadaan = hashBiji(biji) || 1;
  const rawak = () => {
    keadaan = (Math.imul(keadaan, 1664525) + 1013904223) >>> 0;
    return keadaan / 4294967296;
  };
  for (let i = salinan.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rawak() * (i + 1));
    [salinan[i], salinan[j]] = [salinan[j], salinan[i]];
  }
  return salinan;
}

function bersihAktiviti(senarai: string[] | undefined) {
  return (senarai ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

/** Kekalkan set induksi dan penutup; kocak langkah tengah supaya RPH bersebelahan tidak sama. */
export function kocakLangkahTengah(aktiviti: string[], biji: string) {
  if (aktiviti.length < 4) return aktiviti;
  const tengah = kocak(aktiviti.slice(1, -1), biji);
  return [aktiviti[0], ...tengah, aktiviti[aktiviti.length - 1]];
}

export function pilihGayaPdP(biji: string, masteri = false) {
  const senarai = masteri ? GAYA_MASTERI : GAYA_PDP;
  return senarai[hashBiji(biji) % senarai.length];
}

export function pilihAktivitiUntukSesi(bahan: BahanRph, indeksKemunculan: number, biji: string) {
  const amalan = (bahan.variasi?.length ? bahan.variasi : [bahan.aktiviti])
    .map(bersihAktiviti)
    .filter((item) => item.length);
  const masteri = bersihAktiviti(bahan.masteri);
  const semakMasteri = (indeksKemunculan + 1) % 4 === 0 && masteri.length > 0;
  const asas = semakMasteri
    ? masteri
    : amalan.length
      ? amalan[indeksKemunculan % amalan.length]
      : bersihAktiviti(bahan.aktiviti);
  return kocakLangkahTengah(asas, `${biji}|${indeksKemunculan}|${semakMasteri ? "m" : "a"}`);
}

function arahanObjektifDaripadaSp() {
  return `LANGKAH 1 — ANALISIS setiap Standard Pembelajaran. Jangan salin ayatnya.
Untuk setiap SP pecahkan: kod, kata kerja DSKP, konsep yang mesti dikuasai, dan bukti yang boleh dikira dalam SATU sesi PdP.

LANGKAH 2 — TULIS 2-3 objektif yang MENGOPERASIKAN hasil analisis itu.
Setiap objektif SATU ayat panjang bermula "Murid dapat ...".

DILARANG:
- "Murid dapat " diikuti ayat Standard Pembelajaran (contoh dilarang: "Murid dapat menerangkan keperluan penyelesaian masalah berstrategi").
- Kata kerja kabur: memahami, mengetahui, menghayati, menyedari, menghargai.
- Perkataan: beberapa, pelbagai, sesuai.

WAJIB dalam SETIAP objektif — sekurang-kurangnya DUA nombor Arab yang guru boleh semak ya/tidak:
- menyatakan / memberi contoh → berapa contoh (contoh 3)
- menyenaraikan → berapa perkara (contoh 4) + berapa senario/justifikasi
- membandingkan → berapa perbezaan (contoh 3) + masa atau bilangan hujah
- menulis/menghasilkan → berapa langkah/ayat + kriteria ketepatan
- membentangkan → berapa isi atau berapa minit

GAYA YANG WAJIB DIIKUTI (isi mengikut SP yang dianalisis):
"Murid dapat menyatakan 3 contoh … secara lisan/bertulis berdasarkan 1 senario … dengan 2 justifikasi yang tepat."
"Murid dapat menyenaraikan 4 keperluan … berdasarkan 1 senario … dengan 2 justifikasi yang tepat."
"Murid dapat membandingkan 3 perbezaan … dalam masa 10 minit, dengan sekurang-kurangnya 2 hujah yang logik."`;
}

function arahanAktivitiDaripadaObjektif(gaya?: string, masteri = false) {
  const fokus = masteri
    ? `FOKUS SESI INI: SEMAKAN MASTERI berkala. Murid menunjukkan bukti penguasaan (kuiz, exit ticket, tugasan prestasi, rakan semak), bukan syarahan ulang.`
    : `FOKUS SESI INI: aktiviti PdP berpusatkan murid. GAYA WAJIB: ${gaya ?? "think-pair-share"}.`;
  return `LANGKAH 3 — TULIS 5-8 aktiviti TERPERINCI yang BERPUSATKAN MURID, berpandukan objektif yang anda tulis.
${fokus}
Murid yang aktif: meneroka, berbincang, menyatakan contoh, menyenaraikan, menghasilkan, mempersembah, menilai rakan.
Guru sebagai fasilitator, BUKAN syarahan panjang. Dilarang langkah "Guru menerangkan..." sebagai aktiviti utama.
Setiap langkah 1-3 ayat: apa murid buat, dengan bahan apa, berapa item atau berapa minit, dan hasil yang dijangka.
Susunan: set induksi, aktiviti utama murid, semakan pembelajaran (semak nombor dalam objektif), penutup.
DILARANG ulang ayat, urutan, atau kaedah yang sama seperti RPH lain. Variasikan kumpulan (individu/berpasangan/4 orang), bahan, dan hasil.
Contoh baik: "Murid dalam kumpulan 4 orang menyatakan 3 contoh pada kertas sebak berdasarkan 1 senario, kemudian gallery walk selama 8 minit supaya rakan menambah 2 komen."`;
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
  gaya?: string;
  masteri?: boolean;
};

function tapisSp(input: KonteksSesi) {
  const sp = input.standard_pembelajaran.filter((item) => item.pernyataan.trim());
  if (!sp.length) throw new Error("Pilih standard pembelajaran dahulu.");
  if (!hasGeminiKey()) throw new Error("Kunci Gemini belum dikonfigurasi.");
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

${arahanObjektifDaripadaSp()}`;
}

export async function janaObjektifSesi(input: KonteksSesi): Promise<string[]> {
  const sp = tapisSp(input);
  const output = await janaObjek(
    objektifSahajaSchema,
    `${promptKonteksSesi(input, sp)}

Hasilkan HANYA medan objektif. Setiap objektif mesti lahir daripada analisis SP di atas, bukan salinan ayat SP.`
  );
  if (!output?.objektif?.length) throw new Error("Gemini tidak menghasilkan objektif.");
  return output.objektif.map((item) => item.trim()).filter(Boolean).slice(0, 3);
}

export async function janaBahanSesi(input: KonteksSesi): Promise<BahanRph> {
  const sp = tapisSp(input);
  const biji = [input.mata_pelajaran, input.kelas, input.hari, input.masa, input.sk_kod, String(Date.now())].join("|");
  const masteri = Boolean(input.masteri);
  const gaya = input.gaya?.trim() || pilihGayaPdP(biji, masteri);
  const output = await janaObjek(
    sesiSchema,
    `${promptKonteksSesi(input, sp)}

${arahanAktivitiDaripadaObjektif(gaya, masteri)}

Tugas tambahan:
1. objektif: ikut arahan analisis di atas.
2. aktiviti: 5-8 langkah MENGIKUT gaya "${gaya}". Jangan salin template gallery walk jika gaya lain dipilih.
3. bbm: bahan realistik di sekolah Malaysia, sepadan dengan gaya.
4. nilai: satu nilai murni KSSM (contoh PEMIKIR, PRIHATIN, AMANAH).

Jangan ulang ayat standard pembelajaran sebagai aktiviti.`
  );

  if (!output) throw new Error("Gemini tidak menghasilkan objektif dan aktiviti.");
  const aktiviti = kocakLangkahTengah(bersihAktiviti(output.aktiviti), biji);
  return {
    objektif: output.objektif.map((item) => item.trim()).filter(Boolean).slice(0, 3),
    bbm: output.bbm.trim(),
    nilai: (output.nilai || "PEMIKIR").trim(),
    aktiviti,
  };
}

function bahanAsal(unit: UnitKurikulum): BahanRph {
  const konsep = unit.sk_tajuk || unit.sk_kod;
  const penerokaan = [
    `Set induksi: murid meneliti 1 senario berkaitan ${konsep} dan menyatakan 2 jawapan awal kepada rakan sebelah.`,
    `Murid berpasangan menyenaraikan 4 isi berkaitan ${konsep} pada kertas sebak berdasarkan senario yang diberi.`,
    `Setiap pasangan berkongsi 3 contoh dengan pasangan lain selama 6 minit dan menambah 1 isi baharu.`,
    `Perwakilan menyatakan 2 hujah utama di hadapan kelas manakala rakan menanda senarai semak.`,
    `Murid individu menulis 3 contoh dan 2 justifikasi pada lembaran kerja tanpa merujuk nota.`,
    `Murid menyemak nombor dalam objektif bersama rakan dan membetulkan 1 kesilapan sebelum penutup.`,
  ];
  const aplikasi = [
    `Set induksi: murid di 3 stesen meneka 2 jawapan berkaitan ${konsep} pada kad soalan, kemudian pusing stesen.`,
    `Kumpulan 4 orang menghasilkan 1 peta minda ${konsep} dengan sekurang-kurangnya 4 cabang dan 3 contoh.`,
    `Dua kumpulan bertukar peta minda dan menambah 2 komen pembetulan dalam masa 8 minit.`,
    `Murid dalam jigsaw mengajar rakan 2 isi pakar masing-masing, rakan mencatat 3 isi baharu.`,
    `Setiap murid menyelesaikan 1 cabaran 10 minit: 3 contoh ${konsep} dengan 2 justifikasi bertulis.`,
    `Kelas menyemak 2 hasil rakan secara sukarela dan menutup dengan 1 soalan exit ticket.`,
  ];
  const masteri = [
    `Set induksi: murid menanda sendiri tahap penguasaan ${konsep} (sudah kuasai / belum) pada kad exit.`,
    `Murid individu menjawab kuiz masteri 5 item berkaitan ${konsep} dalam masa 8 minit tanpa nota.`,
    `Rakan semak menukar kertas dan menanda 5 item menggunakan senarai semak bukti penguasaan.`,
    `Murid yang belum kuasai mengulang 3 contoh dengan bantuan rakan, yang sudah kuasai menambah 2 senario baharu.`,
    `Perwakilan mendemonstrasikan 1 tugasan prestasi ${konsep} selama 2 minit sebagai bukti penguasaan.`,
    `Murid mengemaskini peta masteri (sudah/belum) dan menulis 1 langkah susulan sebelum penutup.`,
  ];
  return {
    objektif: [
      `Murid dapat menyatakan 3 contoh berkaitan ${konsep} secara bertulis pada lembaran kerja individu berdasarkan 1 senario yang diberi, dengan 2 justifikasi yang tepat.`,
      `Murid dapat menyenaraikan 4 isi utama ${konsep} dalam kumpulan dalam masa 10 minit, kemudian membentangkan sekurang-kurangnya 2 hujah yang logik.`,
    ],
    bbm: "Buku teks, lembaran kerja, kertas sebak, pen marker, kad soalan, projektor LCD",
    nilai: "PEMIKIR",
    aktiviti: penerokaan,
    variasi: [penerokaan, aplikasi],
    masteri,
  };
}

function petaDariGemini(item: {
  sk_kod: string;
  objektif: string[];
  bbm: string;
  nilai: string;
  aktiviti_penerokaan: string[];
  aktiviti_aplikasi: string[];
  aktiviti_masteri: string[];
}): BahanRph {
  const penerokaan = bersihAktiviti(item.aktiviti_penerokaan);
  const aplikasi = bersihAktiviti(item.aktiviti_aplikasi);
  const masteri = bersihAktiviti(item.aktiviti_masteri);
  return {
    objektif: item.objektif.filter(Boolean).slice(0, 3),
    bbm: item.bbm,
    nilai: item.nilai || "PEMIKIR",
    aktiviti: penerokaan,
    variasi: [penerokaan, aplikasi].filter((senarai) => senarai.length),
    masteri,
  };
}

export async function janaBahanKurikulum(kurikulum: KurikulumPilihan) {
  const unitList = ratakanKurikulum(kurikulum);
  const peta = new Map<string, BahanRph>();
  for (const unit of unitList) peta.set(unit.sk_kod, bahanAsal(unit));
  if (!unitList.length || !hasGeminiKey()) return peta;

  const ringkas = unitList.map((unit) => ({
    sk_kod: unit.sk_kod,
    sk_tajuk: unit.sk_tajuk,
    bidang: unit.bidang_nama,
    standard_pembelajaran: unit.standard_pembelajaran.map((item) => ({
      kod: item.kod,
      pernyataan: item.pernyataan,
    })),
  }));

  const saiz = 3;
  for (let i = 0; i < ringkas.length; i += saiz) {
    const bahagian = ringkas.slice(i, i + saiz);
    try {
      const output = await janaObjek(
        bahanSchema,
        `Anda guru pakar KSSM Malaysia. ANALISIS Standard Pembelajaran, kemudian tulis kandungan RPH untuk SETIAP Standard Kandungan dalam bahasa Melayu standard sekolah.

Mata pelajaran: ${kurikulum.mata_pelajaran}
Tingkatan: ${kurikulum.tingkatan ?? "-"}

Untuk SETIAP sk_kod:
1. ANALISIS setiap Standard Pembelajaran. Jangan salin ayat SP.
2. objektif: 2-3 ayat TERPERINCI yang BOLEH DIUKUR.
3. TIGA set aktiviti BERPUSATKAN MURID yang BERBEZA kaedah (boleh tema sama, dilarang salin ayat):
   - aktiviti_penerokaan: sesi pertama (think-pair-share / stesen / ramalan).
   - aktiviti_aplikasi: sesi seterusnya (jigsaw / gallery walk / permainan / peta minda / role-play).
   - aktiviti_masteri: semakan masteri BERKALA (kuiz 5 item, exit ticket, tugasan prestasi, rakan semak bukti penguasaan).
   Setiap set 5-8 langkah. Jangan ulang urutan atau kaedah merentas tiga set.
4. bbm dan nilai.

${arahanObjektifDaripadaSp()}

${arahanAktivitiDaripadaObjektif("bervariasi mengikut tiga set", false)}

Jangan cipta kod baharu. Padankan sk_kod dengan tepat.

${JSON.stringify(bahagian, null, 2)}`
      );
      for (const item of output?.bahan ?? []) {
        if (!item.sk_kod) continue;
        peta.set(item.sk_kod, petaDariGemini(item));
      }
    } catch (error) {
      console.error("janaBahanKurikulum", error);
    }
  }

  return peta;
}
