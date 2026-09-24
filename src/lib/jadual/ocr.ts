import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorker, PSM } from "tesseract.js";
import type { RujukanMataPelajaran } from "./parse";
import { perkataanDariBlok, perkataanDariTsv, sesiLengkapDariOcr } from "./ocr-grid";
import type { SesiPdp } from "./types";

export { sesiDariOcr } from "./ocr-grid";

function pilihanPekerjaTesseract() {
  const tessdata = path.join(process.cwd(), "vendor", "tessdata", "eng.traineddata");
  const tessdataAkar = path.join(process.cwd(), "eng.traineddata");
  const sumber = existsSync(tessdata) ? tessdata : existsSync(tessdataAkar) ? tessdataAkar : "";
  if (!sumber) {
    throw new Error("Enjin OCR tidak lengkap di pelayan (data bahasa).");
  }
  const cachePath = path.join(tmpdir(), "e-rph-tesseract");
  mkdirSync(cachePath, { recursive: true });
  const cacheFail = path.join(cachePath, "eng.traineddata");
  if (!existsSync(cacheFail)) copyFileSync(sumber, cacheFail);
  return {
    cachePath,
    langPath: path.dirname(sumber),
    gzip: false,
    workerBlobURL: false as const,
    cacheMethod: "write" as const,
  };
}

async function denganHadMasa<T>(janji: Promise<T>, ms: number, mesej: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      janji,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(mesej)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function analyzeJadualOcr(
  bytes: Uint8Array,
  rujukan: RujukanMataPelajaran[] = []
): Promise<SesiPdp[]> {
  const worker = await denganHadMasa(
    createWorker("eng", 1, pilihanPekerjaTesseract()),
    20000,
    "Enjin OCR pelayan tidak tersedia. Cuba muat naik semula daripada pelayar."
  );
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
    });
    const result = await denganHadMasa(
      worker.recognize(Buffer.from(bytes), {}, { text: true, blocks: true, tsv: true }),
      25000,
      "Bacaan gambar terlalu lama. Cuba gambar yang lebih terang dan tidak terlalu besar."
    );
    const dariBlok = perkataanDariBlok(result.data.blocks);
    const words = dariBlok.length ? dariBlok : perkataanDariTsv(String(result.data.tsv ?? ""));
    if (!words.length) {
      throw new Error(
        "Gambar jadual tidak dapat dibaca. Cuba JPG/PNG yang terang, atau tukar HEIC kepada JPG."
      );
    }
    return sesiLengkapDariOcr(words, rujukan);
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}
