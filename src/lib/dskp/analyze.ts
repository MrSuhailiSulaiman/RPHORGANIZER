import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { geminiApiKey, runtimeEnv } from "@/lib/runtime-env";
import { parseDskpText, teksKurikulumDskp } from "./parse";
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

const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
] as const;

const INSTRUCTIONS = `Anda mengekstrak DSKP KSSM Malaysia.
Ambil HANYA:
1. Bidang Pembelajaran (kod seperti 1.0)
2. Standard Kandungan (kod seperti 1.1)
3. Standard Pembelajaran (kod seperti 1.1.1)

JANGAN masukkan Standard Prestasi, Tahap Penguasaan, rubrik, atau tafsiran 1-6.
Jika ada sub-item (i) (ii) (iii), letakkan dalam butiran. Jika tiada, butiran = [].
penerangan, tahun_terbitan, dan jam mesti string. Jika tiada, guna string kosong.
jam contoh "20" atau "".
Kekalkan bahasa asal dokumen.
Lengkapkan tajuk yang terputus merentas lajur PDF.`;

function googleModel(nama: string) {
  return createGoogleGenerativeAI({ apiKey: geminiApiKey() })(nama);
}

function bolehCubaModelLain(error: unknown) {
  const mesej = error instanceof Error ? error.message : String(error);
  return /high demand|no longer available|not found|not supported|404|unavailable|quota|rate[- ]limit|429|resource exhausted|overloaded|pattern|schema|invalid.?argument|timeout/i.test(
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

  return {
    mata_pelajaran: object.mata_pelajaran.trim(),
    tingkatan: object.tingkatan.trim(),
    tahun_terbitan: teksAtauNull(object.tahun_terbitan),
    bidang,
    kaedah_analisis: "ai",
  };
}

async function janaDskpAi(params: {
  prompt: string;
  pdfBytes?: Uint8Array;
}): Promise<DskpAiSchema> {
  const content =
    hasGoogleKey() && params.pdfBytes
      ? [
          { type: "text" as const, text: params.prompt },
          {
            type: "file" as const,
            data: params.pdfBytes,
            mediaType: "application/pdf",
          },
        ]
      : params.prompt;

  const outputOptions =
    typeof content === "string"
      ? { prompt: content }
      : { messages: [{ role: "user" as const, content }] };

  if (hasGoogleKey()) {
    let last: unknown;
    for (const nama of GEMINI_MODELS) {
      try {
        const { output } = await generateText({
          model: googleModel(nama),
          output: Output.object({ schema: dskpAiSchema }),
          maxRetries: 1,
          ...outputOptions,
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
    maxRetries: 1,
    ...outputOptions,
  });
  if (!output?.bidang?.length) {
    throw new Error("Model AI pulangkan struktur DSKP kosong.");
  }
  return output;
}

async function analyzeWithAi(params: {
  text: string;
  parsed: DskpExtract;
  pdfBytes?: Uint8Array;
}): Promise<DskpExtract> {
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

Hasil parser awal (betulkan jika salah atau tidak lengkap):
${hint}

Teks DSKP (bahagian relevan):
${kurikulum.slice(0, 60000)}`;

  const teksCukup = kurikulum.replace(/\s+/g, " ").trim().length >= 800;
  const pdfKecil = (params.pdfBytes?.byteLength ?? 0) > 0 && (params.pdfBytes?.byteLength ?? 0) <= 4 * 1024 * 1024;
  const pdfBytes = !teksCukup && pdfKecil ? params.pdfBytes : undefined;

  const object = await janaDskpAi({ prompt, pdfBytes });
  const extract = dariAi(object);
  if (!extract.bidang.length) {
    throw new Error("Struktur DSKP AI kosong.");
  }
  return extract;
}

export async function analyzeDskp(params: {
  text: string;
  pdfBytes?: Uint8Array;
}): Promise<DskpExtract> {
  const parsed = parseDskpText(params.text);
  if (!hasAiProvider()) {
    return parsed;
  }

  try {
    return await analyzeWithAi({
      text: params.text,
      parsed,
      pdfBytes: params.pdfBytes,
    });
  } catch (error) {
    console.error("analyzeDskp", error instanceof Error ? error.message : error);
    return {
      ...parsed,
      amaran: "Analisis AI tidak lengkap untuk fail ini. Parser DSKP digunakan.",
    };
  }
}
