import {
  cantumSesiBersambung,
  kembangkanMataPelajaran,
  parseCsv,
  parseJadualMatrix,
  parseSelGuru,
  sesiDariSlot,
  CONTOH_CSV,
} from "../src/lib/jadual/parse";

const sesi = parseJadualMatrix(parseCsv(CONTOH_CSV));
if (sesi.length !== 4) {
  throw new Error(`expected 4 sessions, got ${sesi.length}`);
}
const pertama = sesi[0];
if (pertama.kelas !== "UTM" || pertama.hari !== "ISNIN" || pertama.mata_pelajaran !== "SAINS KOMPUTER") {
  throw new Error(`unexpected first session ${JSON.stringify(pertama)}`);
}
if (pertama.masa !== "11.40 - 12.20" || pertama.tingkatan !== "Tingkatan 5") {
  throw new Error(`unexpected time/form ${JSON.stringify(pertama)}`);
}

if (kembangkanMataPelajaran("SC KOM") !== "SAINS KOMPUTER") {
  throw new Error("SC KOM should expand");
}
if (kembangkanMataPelajaran("ASK") !== "ASAS SAINS KOMPUTER") {
  throw new Error("ASK should expand");
}

const sel = parseSelGuru("4 UTM SC KOM");
if (!sel || sel.kelas !== "UTM" || sel.tingkatan !== "Tingkatan 4" || sel.mata_pelajaran !== "SAINS KOMPUTER") {
  throw new Error(`unexpected cell ${JSON.stringify(sel)}`);
}

const gabung = cantumSesiBersambung([
  {
    kelas: "USM",
    tingkatan: "Tingkatan 4",
    hari: "ISNIN",
    masa: "13.00 - 13.40",
    masa_mula: "13.00",
    masa_tamat: "13.40",
    mata_pelajaran: "SAINS KOMPUTER",
  },
  {
    kelas: "USM",
    tingkatan: "Tingkatan 4",
    hari: "ISNIN",
    masa: "13.45 - 14.20",
    masa_mula: "13.45",
    masa_tamat: "14.20",
    mata_pelajaran: "SAINS KOMPUTER",
  },
]);
if (gabung.length !== 1 || gabung[0].masa !== "13.00 - 14.20") {
  throw new Error(`expected merged double period, got ${JSON.stringify(gabung)}`);
}

const grid = parseJadualMatrix([
  ["", "6:40-7:20", "8:00-8:40", "13:00-13:40", "13:45-14:20"],
  ["Isnin", "5 UTM SC KOM", "4 UTM SC KOM", "4 USM SC KOM", "4 USM SC KOM"],
  ["Selasa", "", "3 USM ASK", "", ""],
]);
const isninUsM = grid.filter((item) => item.hari === "ISNIN" && item.kelas === "USM");
if (isninUsM.length !== 2 || isninUsM[0].masa !== "13.00 - 13.40" || isninUsM[1].masa !== "13.45 - 14.20") {
  throw new Error(`grid double period failed ${JSON.stringify(isninUsM)}`);
}

const daripadaGambar = sesiDariSlot([
  {
    hari: "Khamis",
    masa_mula: "06.40",
    masa_tamat: "07.20",
    kelas: "3 UTM",
    mata_pelajaran: "ASK",
  },
  {
    hari: "Jumaat",
    masa_mula: "08.00",
    masa_tamat: "08.40",
    kelas: "4 UTM",
    mata_pelajaran: "SC KOM",
  },
]);
if (daripadaGambar.length !== 2) {
  throw new Error(`slot conversion failed ${JSON.stringify(daripadaGambar)}`);
}
if (
  daripadaGambar[0].mata_pelajaran !== "ASAS SAINS KOMPUTER" ||
  daripadaGambar[1].mata_pelajaran !== "SAINS KOMPUTER"
) {
  throw new Error(`abbreviation expand failed ${JSON.stringify(daripadaGambar)}`);
}

console.log("parser ok", sesi.length, "sesi contoh,", grid.length, "sesi grid");
