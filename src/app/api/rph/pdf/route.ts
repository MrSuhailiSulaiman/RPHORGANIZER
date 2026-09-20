import { connection } from "next/server";
import { NextResponse } from "next/server";
import { binaPdfRphMinggu, namaFailPdfMinggu } from "@/lib/rph/pdf";
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
  try {
    await connection();
    const body = (await request.json().catch(() => ({}))) as {
      ids?: unknown;
      minggu?: unknown;
      tarikh_mula?: unknown;
      tarikh_tamat?: unknown;
    };
    const ids = (Array.isArray(body.ids) ? body.ids : [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (!ids.length) {
      return json({ ralat: "Pilih sekurang-kurangnya satu sesi RPH untuk dimuat turun." }, 400);
    }
    const rekod = await getRphMengikutId(ids);
    if (!rekod.length) {
      return json({ ralat: "Tiada rekod RPH untuk minggu ini." }, 404);
    }
    const minggu = Number(body.minggu);
    const nomborMinggu = Number.isFinite(minggu) && minggu > 0 ? Math.floor(minggu) : 1;
    const pdf = await binaPdfRphMinggu({ rekod, minggu: nomborMinggu });
    const nama = namaFailPdfMinggu(
      nomborMinggu,
      typeof body.tarikh_mula === "string" ? body.tarikh_mula : rekod[0]?.tarikh,
      typeof body.tarikh_tamat === "string" ? body.tarikh_tamat : rekod[rekod.length - 1]?.tarikh
    );
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nama}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menjana PDF RPH.";
    console.error("pdf_rph", mesej);
    return json({ ralat: mesej }, 500);
  }
}
