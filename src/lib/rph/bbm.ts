const HURAI = /\s+(yang|untuk|bagi|supaya|sebagai|semasa|agar|iaitu)\b[\s\S]*$/i;

/** Nama bahan sahaja. Buang ayat huraian. */
export function ringkasBbm(teks: string) {
  const asal = teks.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!asal) return "";
  const keping = asal
    .split(/[,;]|\s+(?:dan|serta)\s+/i)
    .map((item) =>
      item
        .replace(/^[-–•]\s*/, "")
        .replace(/[.!?]+$/g, "")
        .replace(/^(murid|guru)\s+(menggunakan|memakai|diberi|menerima)\s+/i, "")
        .replace(HURAI, "")
        .trim()
    )
    .filter((item) => item.length >= 2 && item.length <= 40);
  const senarai = (keping.length ? keping : [asal.replace(HURAI, "").split(/[.!?]/)[0].trim()]).slice(0, 5);
  let hasil = senarai.join(", ");
  if (hasil.length > 80) {
    const potong = hasil.slice(0, 80);
    const koma = potong.lastIndexOf(",");
    hasil = koma > 12 ? potong.slice(0, koma) : potong;
  }
  return hasil.replace(/[,.\s]+$/g, "");
}
