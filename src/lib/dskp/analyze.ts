import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { geminiApiKey, runtimeEnv } from "@/lib/runtime-env";
import { parseDskpText } from "./parse";
import { dskpExtractSchema } from "./schema";
import type { DskpExtract } from "./types";

function hasGoogleKey() {
  return Boolean(geminiApiKey());
}

function hasOpenAiKey() {
  return Boolean(runtimeEnv("OPENAI_API_KEY"));
}

export function hasAiProvider() {
  return hasGoogleKey() || hasOpenAiKey();
}

const INSTRUCTIONS = `Anda mengekstrak DSKP KSSM Malaysia.
Ambil HANYA:
1. Bidang Pembelajaran (kod seperti 1.0)
2. Standard Kandungan (kod seperti 1.1)
3. Standard Pembelajaran (kod seperti 1.1.1)

JANGAN masukkan Standard Prestasi, Tahap Penguasaan, rubrik, atau tafsiran 1-6.
Jika ada sub-item (i) (ii) (iii), letakkan dalam butiran.
Kekalkan bahasa asal dokumen.
Lengkapkan tajuk yang terputus merentas lajur PDF.`;

async function analyzeWithAi(params: {
  text: string;
  parsed: DskpExtract;
  pdfBytes?: Uint8Array;
}): Promise<DskpExtract> {
  const hint = JSON.stringify(
    {
      mata_pelajaran: params.parsed.mata_pelajaran,
      tingkatan: params.parsed.tingkatan,
      tahun_terbitan: params.parsed.tahun_terbitan,
      bidang: params.parsed.bidang.map((bidang) => ({
        kod: bidang.kod,
        nama: bidang.nama,
        jam: bidang.jam,
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

  const prompt = `${INSTRUCTIONS}

Hasil parser awal (betulkan jika salah atau tidak lengkap):
${hint}

Teks DSKP (bahagian relevan):
${params.text.slice(0, 40000)}`;

  const model = hasGoogleKey()
    ? createGoogleGenerativeAI({ apiKey: geminiApiKey() })("gemini-2.5-flash")
    : openai("gpt-4o");

  const content =
    hasGoogleKey() && params.pdfBytes
      ? [
          { type: "text" as const, text: prompt },
          {
            type: "file" as const,
            data: params.pdfBytes,
            mediaType: "application/pdf",
          },
        ]
      : prompt;

  const { object } = await generateObject({
    model,
    schema: dskpExtractSchema,
    schemaName: "DskpKssm",
    ...(typeof content === "string"
      ? { prompt: content }
      : { messages: [{ role: "user", content }] }),
    maxOutputTokens: 16000,
  });

  return {
    ...object,
    kaedah_analisis: "ai",
  };
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
    const mesej = error instanceof Error ? error.message : "AI gagal";
    return {
      ...parsed,
      amaran: `Analisis AI gagal, parser DSKP digunakan. (${mesej})`,
    };
  }
}
