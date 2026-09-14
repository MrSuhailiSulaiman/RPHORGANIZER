import { parseCsv, parseJadualMatrix, CONTOH_CSV } from "../src/lib/jadual/parse";

const sesi = parseJadualMatrix(parseCsv(CONTOH_CSV));
if (sesi.length !== 3) {
  throw new Error(`expected 3 sessions, got ${sesi.length}`);
}
const pertama = sesi[0];
if (pertama.kelas !== "UTM" || pertama.hari !== "ISNIN" || pertama.mata_pelajaran !== "SAINS KOMPUTER") {
  throw new Error(`unexpected first session ${JSON.stringify(pertama)}`);
}
if (pertama.masa !== "11.40 - 13.00" || pertama.tingkatan !== "Tingkatan 5") {
  throw new Error(`unexpected time/form ${JSON.stringify(pertama)}`);
}
console.log("parser ok", sesi.length, "sesi");
