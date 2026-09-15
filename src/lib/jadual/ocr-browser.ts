import { createWorker, PSM } from "tesseract.js";
import { perkataanDariBlok, perkataanDariTsv, sesiLengkapDariOcr } from "./ocr-grid";
import type { SesiPdp } from "./types";

export async function analyzeJadualOcrPelayar(file: File): Promise<SesiPdp[]> {
  const worker = await createWorker("eng", 1, {
    gzip: true,
    workerBlobURL: true,
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-lstm.wasm.js",
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
    });
    const result = await worker.recognize(file, {}, { text: true, blocks: true, tsv: true });
    const dariBlok = perkataanDariBlok(result.data.blocks);
    const words = dariBlok.length ? dariBlok : perkataanDariTsv(String(result.data.tsv ?? ""));
    if (!words.length) {
      throw new Error("Gambar jadual tidak dapat dibaca. Cuba JPG/PNG yang terang.");
    }
    return sesiLengkapDariOcr(words);
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}
