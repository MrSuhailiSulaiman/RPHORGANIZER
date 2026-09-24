import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { geminiApiKey, runtimeEnv } from "@/lib/runtime-env";
import { parseDskpText, teksKurikulumDskp, bersihkanExtractDskp } from "./parse";
import { dskpAiSchema, type DskpAiSchema } from "./schema";
import type { BidangPembelajaran, DskpExtract } from "./types";

function hasGoogleKey() {
  return Boolean(geminiApiKey());
}

function hasOpenAiKey() {
  return Boolean(runtimeEnv("OPENAI_API_KEY"));
}

export function hasAiProvider() {
  return hasGoogleKey() || hasOpenAiKey();
}

const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"] as const;
const MASA_AI_MS = 18_000;

const INSTRUCTIONS = `Anda mengekstrak DSKP KSSM Malaysia.

Kelaskan HANYA mengikut bentuk kod. Jangan ikut tajuk lajur jika nombor tidak sepadan.
1. Bidang Pembelajaran = nombor.0 sahaja. Contoh: 1.0, 2.0, 3.0. Nama bidang sahaja.
2. Standard Kandungan = nombor.nombor, dan nombor kedua BUKAN 0. Contoh: 1.1, 1.2, 2.1, 2.2, 2.3. Tajuk SK sahaja.
3. Standard Pembelajaran = nombor.nombor.nombor. Contoh: 1.1.1, 1.2.3, 2.1.1, 3.3.11. Ayat kurikulum sahaja.
Sarang mengikut awalan: 1.1 dan 1.2 di bawah 1.0; 1.1.1 di bawah 1.1; 3.3.11 di bawah 3.3, dan 3.3 di bawah 3.0.
Jangan letak 1.1 sebagai Bidang. Jangan letak 1.0 atau 1.1.1 sebagai Standard Kandungan. Jangan letak 1.1 sebagai Standard Pembelajaran.

JANGAN ambil, salin, gabung, atau simpan daripada lajur/bahagian lain:
- Cadangan Aktiviti / Cadangan PdP / aktiviti cadangan
- Tahap Penguasaan 1-6 / Standard Prestasi / Tafsiran / rubrik
- Nota, glosari, rasional, pengenalan, projek

Lajur kanan DSKP (Cadangan Aktiviti dan Tahap Penguasaan) BUKAN standard pembelajaran.
Jika ayat SP bersambung dengan cadangan aktiviti atau "1 Menyatakan... 2 Menerangkan...", potong SEBELUM bahagian itu.
pernyataan SP hanya ayat kurikulum, contoh: "Menerangkan keperluan penyelesaian masalah berstrategi"
Jangan salin descriptor TP seperti "Menyatakan", "Menerangkan", "Mengaplikasi", "Menganalisis", "Menilai", "Mencipta" yang bernombor 1-6.
Jika ada sub-item kurikulum (i) (ii) (iii), letakkan dalam butiran. Jika tiada, butiran = [].
Jangan letak langkah aktiviti PdP dalam butiran.
penerangan, tahun_terbitan, dan jam mesti string. Jika tiada, guna string kosong.
jam contoh "20" atau "".
Kekalkan bahasa asal dokumen.
Lengkapkan tajuk yang terputus merentas lajur PDF.`;

function googleModel(nama: string) {
  return createGoogleGenerativeAI({ apiKey: geminiApiKey() })(nama);
}

function bolehCubaModelLain(error: unknown) {
  const mesej = error instanceof Error ? error.message : String(error);
  return /high demand|no longer available|not found|not supported|404|unavailable|quota|rate[- ]limit|429|resource exhausted|overloaded|pattern|schema|invalid.?argument|timeout|abort/i.test(
    mesej
  );
}

function teksAtauNull(value: string) {
  const teks = value.trim();
  return teks.length ? teks : null;
}

function nomborAtauNull(value: string) {
  const nombor = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(nombor) && nombor > 0 ? nombor : null;
}

function dariAi(object: DskpAiSchema): DskpExtract {
  const bidang: BidangPembelajaran[] = object.bidang.map((item) => ({
    kod: item.kod.trim(),
    nama: item.nama.trim() || item.kod,
    penerangan: teksAtauNull(item.penerangan),
    jam: nomborAtauNull(item.jam),
    standard_kandungan: item.standard_kandungan.map((sk) => ({
      kod: sk.kod.trim(),
      tajuk: sk.tajuk.trim() || sk.kod,
      standard_pembelajaran: sk.standard_pembelajaran.map((sp) => ({
        kod: sp.kod.trim(),
        pernyataan: sp.pernyataan.trim(),
        butiran: sp.butiran.map((butiran) => butiran.trim()).filter(Boolean),
      })),
    })),
  }));

  return bersihkanExtractDskp({
    mata_pelajaran: object.mata_pelajaran.trim(),
    tingkatan: object.tingkatan.trim(),
    tahun_terbitan: teksAtauNull(object.tahun_terbitan),
    bidang,
    kaedah_analisis: "ai",
  });
}

async function janaDskpAi(prompt: string): Promise<DskpAiSchema> {
  if (hasGoogleKey()) {
    let last: unknown;
    for (const nama of GEMINI_MODELS) {
      try {
        const { output } = await generateText({
          model: googleModel(nama),
          output: Output.object({ schema: dskpAiSchema }),
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(12_000),
          prompt,
        });
        if (output?.bidang?.length) return output;
        last = new Error("Gemini pulangkan struktur DSKP kosong.");
      } catch (error) {
        last = error;
        console.error("dskp_gemini_model", nama, error instanceof Error ? error.message : error);
        if (!bolehCubaModelLain(error)) throw error;
      }
    }
    throw last instanceof Error ? last : new Error("Gemini gagal menganalisis DSKP.");
  }

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({ schema: dskpAiSchema }),
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(12_000),
    prompt,
  });
  if (!output?.bidang?.length) {
    throw new Error("Model AI pulangkan struktur DSKP kosong.");
  }
  return output;
}

async function analyzeWithAi(params: { text: string; parsed: DskpExtract }): Promise<DskpExtract> {
  const hint = JSON.stringify(
    {
      mata_pelajaran: params.parsed.mata_pelajaran,
      tingkatan: params.parsed.tingkatan,
      tahun_terbitan: params.parsed.tahun_terbitan ?? "",
      bidang: params.parsed.bidang.map((bidang) => ({
        kod: bidang.kod,
        nama: bidang.nama,
        penerangan: bidang.penerangan ?? "",
        jam: bidang.jam == null ? "" : String(bidang.jam),
        standard_kandungan: bidang.standard_kandungan.map((sk) => ({
          kod: sk.kod,
          tajuk: sk.tajuk,
          standard_pembelajaran: sk.standard_pembelajaran.map((sp) => ({
            kod: sp.kod,
            pernyataan: sp.pernyataan,
            butiran: sp.butiran,
          })),
        })),
      })),
    },
    null,
    2
  );

  const kurikulum = teksKurikulumDskp(params.text);
  const prompt = `${INSTRUCTIONS}

Hasil parser awal (sudah ditapis kepada Bidang, Standard Kandungan, Standard Pembelajaran sahaja; betulkan jika salah atau tidak lengkap):
${hint.slice(0, 20000)}

Teks kurikulum DSKP (tanpa Cadangan Aktiviti dan Tahap Penguasaan):
${kurikulum.slice(0, 25000)}`;

  const object = await janaDskpAi(prompt);
  const extract = dariAi(object);
  if (!extract.bidang.length) {
    throw new Error("Struktur DSKP AI kosong.");
  }
  return extract;
}

export async function analyzeDskp(params: { text: string }): Promise<DskpExtract> {
  const parsed = parseDskpText(params.text);
  if (!hasAiProvider()) {
    return parsed;
  }

  try {
    return await Promise.race([
      analyzeWithAi({ text: params.text, parsed }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), MASA_AI_MS);
      }),
    ]);
  } catch (error) {
    console.error("analyzeDskp", error instanceof Error ? error.message : error);
    return {
      ...parsed,
      amaran: "Analisis AI tidak lengkap untuk fail ini. Parser DSKP digunakan.",
    };
  }
}
