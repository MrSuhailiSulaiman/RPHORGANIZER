import { PDFDocument, PDFFont, PDFPage, PageSizes, rgb, StandardFonts } from "pdf-lib";
import { HARI_LIST } from "@/lib/jadual/types";
import type { RphRekod } from "./types";

const MARGIN = 36;
const BIRU = rgb(111 / 255, 159 / 255, 196 / 255);
const GARIS = rgb(0.45, 0.45, 0.45);
const TEKS = rgb(0.08, 0.08, 0.08);
const PUTIH = rgb(1, 1, 1);
const SAZ = 8.2;
const SAZ_KECIL = 7.2;
const TINGGI_BARIS = 11;

function teksPdf(nilai: string) {
  return nilai
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\t\n\r\u0020-\u00FF]/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function gabungKodNama(kod: string | null, nama: string | null) {
  const k = (kod ?? "").trim();
  const n = (nama ?? "").trim();
  if (!k) return n || "-";
  if (!n || n === k || n.startsWith(`${k} `)) return n || k;
  return `${k} ${n}`;
}

function isi(nilai: string | null | undefined) {
  const bersih = teksPdf(nilai ?? "");
  return bersih || "-";
}

function pecahBaris(font: PDFFont, teks: string, saiz: number, lebar: number) {
  const sumber = teksPdf(teks) || "-";
  const keluar: string[] = [];
  for (const perenggan of sumber.split(/\n/)) {
    const perkataan = perenggan.split(/\s+/).filter(Boolean);
    if (!perkataan.length) {
      keluar.push("");
      continue;
    }
    let semasa = "";
    for (const kata of perkataan) {
      const cubaan = semasa ? `${semasa} ${kata}` : kata;
      if (font.widthOfTextAtSize(cubaan, saiz) <= lebar) {
        semasa = cubaan;
        continue;
      }
      if (semasa) keluar.push(semasa);
      if (font.widthOfTextAtSize(kata, saiz) <= lebar) {
        semasa = kata;
        continue;
      }
      let potong = "";
      for (const huruf of kata) {
        if (font.widthOfTextAtSize(potong + huruf, saiz) <= lebar) potong += huruf;
        else {
          if (potong) keluar.push(potong);
          potong = huruf;
        }
      }
      semasa = potong;
    }
    if (semasa) keluar.push(semasa);
  }
  return keluar.length ? keluar : ["-"];
}

function susunSesi(rekod: RphRekod[]) {
  return [...rekod].sort((a, b) => {
    const tarikh = String(a.tarikh ?? "").localeCompare(String(b.tarikh ?? ""));
    if (tarikh) return tarikh;
    const ha = HARI_LIST.indexOf((a.hari ?? "") as (typeof HARI_LIST)[number]);
    const hb = HARI_LIST.indexOf((b.hari ?? "") as (typeof HARI_LIST)[number]);
    if (ha !== hb) return (ha < 0 ? 99 : ha) - (hb < 0 ? 99 : hb);
    return String(a.masa ?? "").localeCompare(String(b.masa ?? ""));
  });
}

function senaraiNombor(nilai: string[]) {
  return nilai
    .map((item) => teksPdf(item))
    .filter(Boolean)
    .map((item, i) => `${i + 1}. ${item}`)
    .join("\n");
}

export function namaFailPdfMinggu(minggu: number, mula?: string | null, tamat?: string | null) {
  const julat = [mula, tamat && tamat !== mula ? tamat : ""]
    .filter(Boolean)
    .join("_hingga_");
  return `RPH-Minggu-${String(minggu).padStart(2, "0")}${julat ? `-${julat}` : ""}.pdf`;
}

class Pelukis {
  doc: PDFDocument;
  page!: PDFPage;
  font: PDFFont;
  tebal: PDFFont;
  y = 0;
  lebar: number;
  tinggi: number;

  constructor(doc: PDFDocument, font: PDFFont, tebal: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.tebal = tebal;
    const page = doc.addPage(PageSizes.A4);
    this.page = page;
    this.lebar = page.getWidth() - MARGIN * 2;
    this.tinggi = page.getHeight();
    this.y = this.tinggi - MARGIN;
  }

  mukaBaru() {
    this.page = this.doc.addPage(PageSizes.A4);
    this.lebar = this.page.getWidth() - MARGIN * 2;
    this.tinggi = this.page.getHeight();
    this.y = this.tinggi - MARGIN;
  }

  pastikan(tinggi: number) {
    if (this.y - tinggi < MARGIN) this.mukaBaru();
  }

  teksTengah(tulisan: string, saiz: number, font: PDFFont, y: number) {
    const w = font.widthOfTextAtSize(tulisan, saiz);
    this.page.drawText(tulisan, {
      x: MARGIN + (this.lebar - w) / 2,
      y,
      size: saiz,
      font,
      color: TEKS,
    });
  }

  petak(x: number, yBawah: number, w: number, h: number, isiWarna?: ReturnType<typeof rgb>) {
    if (isiWarna) {
      this.page.drawRectangle({
        x,
        y: yBawah,
        width: w,
        height: h,
        color: isiWarna,
        borderColor: GARIS,
        borderWidth: 0.6,
      });
    } else {
      this.page.drawRectangle({
        x,
        y: yBawah,
        width: w,
        height: h,
        borderColor: GARIS,
        borderWidth: 0.6,
      });
    }
  }

  barisSel(sel: { teks: string; lebar: number; tengah?: boolean; biru?: boolean; tebal?: boolean }[], pad = 4) {
    const saiz = sel[0]?.biru ? SAZ_KECIL : SAZ;
    const dibalut = sel.map((item) => ({
      ...item,
      baris: pecahBaris(item.tebal ? this.tebal : this.font, item.teks, saiz, Math.max(12, item.lebar - pad * 2)),
    }));
    const tinggi = Math.max(18, ...dibalut.map((item) => item.baris.length * TINGGI_BARIS + pad * 2));
    this.pastikan(tinggi);
    let x = MARGIN;
    const yBawah = this.y - tinggi;
    for (const item of dibalut) {
      this.petak(x, yBawah, item.lebar, tinggi, item.biru ? BIRU : undefined);
      const font = item.tebal || item.biru ? this.tebal : this.font;
      const warna = item.biru ? PUTIH : TEKS;
      item.baris.forEach((baris, i) => {
        const tw = font.widthOfTextAtSize(baris, saiz);
        const tx = item.tengah ? x + (item.lebar - tw) / 2 : x + pad;
        this.page.drawText(baris, {
          x: Math.max(x + 2, tx),
          y: this.y - pad - saiz - i * TINGGI_BARIS,
          size: saiz,
          font,
          color: warna,
        });
      });
      x += item.lebar;
    }
    this.y = yBawah;
  }

  barisLabel(label: string, kandungan: string) {
    const labelW = this.lebar * 0.28;
    this.barisSel([
      { teks: label, lebar: labelW, biru: true, tebal: true },
      { teks: kandungan, lebar: this.lebar - labelW },
    ]);
  }
}

function lukisSesi(pelukis: Pelukis, rekod: RphRekod, indeks: number, jumlah: number, minggu: number) {
  pelukis.pastikan(120);
  pelukis.y -= 4;
  pelukis.teksTengah("RANCANGAN PENGAJARAN HARIAN", 13, pelukis.tebal, pelukis.y - 12);
  pelukis.y -= 18;
  const tarikh = [rekod.tarikh, rekod.hari].filter(Boolean).join(" · ");
  pelukis.teksTengah(
    `Minggu ${minggu} · Sesi ${indeks + 1} / ${jumlah}${tarikh ? ` · ${tarikh}` : ""}`,
    8,
    pelukis.font,
    pelukis.y - 8
  );
  pelukis.y -= 16;

  const col = pelukis.lebar / 6;
  pelukis.barisSel(
    ["TARIKH", "HARI", "MASA", "TINGKATAN", "KELAS", "MATA PELAJARAN"].map((teks) => ({
      teks,
      lebar: col,
      tengah: true,
      biru: true,
      tebal: true,
    }))
  );
  pelukis.barisSel(
    [
      isi(rekod.tarikh),
      isi(rekod.hari),
      isi(rekod.masa),
      isi(rekod.tingkatan),
      isi(rekod.kelas),
      isi(rekod.mata_pelajaran),
    ].map((teks) => ({ teks, lebar: col, tengah: true }))
  );

  pelukis.barisLabel("BIDANG PEMBELAJARAN", gabungKodNama(rekod.bidang_kod, rekod.bidang_nama));
  pelukis.barisLabel("STANDARD KANDUNGAN", gabungKodNama(rekod.sk_kod, rekod.sk_tajuk));
  pelukis.barisLabel(
    "STANDARD PEMBELAJARAN",
    rekod.standard_pembelajaran
      .map((item) => `${item.kod} ${item.pernyataan}`.trim())
      .filter(Boolean)
      .join("\n") || "-"
  );
  pelukis.barisLabel("OBJEKTIF PEMBELAJARAN", senaraiNombor(rekod.objektif) || "-");

  const labelW = pelukis.lebar * 0.28;
  const nilaiLabel = pelukis.lebar * 0.12;
  const nilaiIsi = pelukis.lebar * 0.18;
  pelukis.barisSel([
    { teks: "BBM", lebar: labelW, biru: true, tebal: true },
    { teks: isi(rekod.bbm), lebar: pelukis.lebar - labelW - nilaiLabel - nilaiIsi },
    { teks: "NILAI", lebar: nilaiLabel, biru: true, tebal: true, tengah: true },
    { teks: isi(rekod.nilai), lebar: nilaiIsi, tengah: true, tebal: true },
  ]);

  pelukis.barisLabel("RINGKASAN AKTIVITI", senaraiNombor(rekod.aktiviti) || "-");

  const refleksi = [
    rekod.refleksi_peratus != null ? `${rekod.refleksi_peratus}%` : "",
    rekod.refleksi_berjaya == null
      ? ""
      : rekod.refleksi_berjaya
        ? "Murid berjaya menguasai objektif pembelajaran dengan baik"
        : "Murid tidak berjaya menguasai objektif pembelajaran dengan baik",
    rekod.refleksi_catatan ?? "",
  ]
    .map((item) => teksPdf(item))
    .filter(Boolean)
    .join("\n");
  pelukis.barisLabel("REFLEKSI", refleksi || "-");
  pelukis.y -= 18;
}

export async function binaPdfRphMinggu(params: {
  rekod: RphRekod[];
  minggu: number;
}) {
  const rekod = susunSesi(params.rekod);
  const doc = await PDFDocument.create();
  doc.setTitle(`RPH Minggu ${params.minggu}`);
  doc.setAuthor("e-RPH");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const tebal = await doc.embedFont(StandardFonts.HelveticaBold);
  const pelukis = new Pelukis(doc, font, tebal);

  rekod.forEach((item, indeks) => {
    if (indeks > 0) pelukis.mukaBaru();
    lukisSesi(pelukis, item, indeks, rekod.length, params.minggu);
  });

  return doc.save();
}
