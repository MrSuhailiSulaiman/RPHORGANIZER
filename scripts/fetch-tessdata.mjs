import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const DEST_DIR = path.join(process.cwd(), "vendor", "tessdata");
const DEST = path.join(DEST_DIR, "eng.traineddata");
const SOURCE =
  "https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best_int/eng.traineddata.gz";

async function main() {
  if (existsSync(DEST)) {
    console.log("tessdata already present");
    return;
  }
  mkdirSync(DEST_DIR, { recursive: true });
  const res = await fetch(SOURCE);
  if (!res.ok) {
    throw new Error(`Gagal memuat tessdata (${res.status})`);
  }
  const compressed = Buffer.from(await res.arrayBuffer());
  writeFileSync(DEST, gunzipSync(compressed));
  console.log("wrote", DEST);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
