import { connection } from "next/server";
import { NextResponse } from "next/server";
import { wajibSesi } from "@/lib/auth/penjaga";
import { getPengguna } from "@/lib/auth/pengguna";
import { binaPdfRphMinggu, namaFailPdfMinggu, namaFailPdfSesi } from "@/lib/rph/pdf";
import { getRphMengikutId } from "@/lib/rph/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

export async function POST(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    await connection();
    const body = (await request.json().catch(() => ({}))) as {
      ids?: unknown;
      minggu?: unknown;
      tarikh_mula?: unknown;
      tarikh_tamat?: unknown;
      pengguna_id?: unknown;
      satu?: unknown;
    };
    const satu = body.satu === true;
    const ids = (Array.isArray(body.ids) ? body.ids : [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (!ids.length) {
      return json({ ralat: "Pilih sekurang-kurangnya satu sesi RPH untuk dimuat turun." }, 400);
    }
    if (satu && ids.length !== 1) {
      return json({ ralat: "Muat turun sesi ini memerlukan satu RPH sahaja." }, 400);
    }
    let pemilikId = auth.sesi.id;
    let namaPengguna = auth.sesi.nama;
    const sasaranId = typeof body.pengguna_id === "string" ? body.pengguna_id.trim() : "";
    if (sasaranId && sasaranId !== auth.sesi.id) {
      if (auth.sesi.peranan !== "admin") {
        return json({ ralat: "Halaman ini untuk admin sahaja." }, 403);
      }
      const sasaran = await getPengguna(sasaranId);
      if (!sasaran) return json({ ralat: "Pengguna tidak dijumpai." }, 404);
      pemilikId = sasaran.id;
      namaPengguna = sasaran.nama_pengguna;
    }
    const rekod = await getRphMengikutId(ids, pemilikId);
    if (!rekod.length) {
      return json({ ralat: "Tiada rekod RPH untuk minggu ini." }, 404);
    }
    const minggu = Number(body.minggu);
    const nomborMinggu = Number.isFinite(minggu) && minggu > 0 ? Math.floor(minggu) : 1;
    const pdf = await binaPdfRphMinggu({ rekod, minggu: nomborMinggu, satu });
    const nama = satu ? namaFailPdfSesi(rekod[0], namaPengguna) : namaFailPdfMinggu(nomborMinggu, namaPengguna);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nama}"; filename*=UTF-8''${encodeURIComponent(nama)}`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menjana PDF RPH.";
    console.error("pdf_rph", mesej);
    return json({ ralat: mesej }, 500);
  }
}
