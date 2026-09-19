import { connection } from "next/server";
import { NextResponse } from "next/server";
import { MAX_DSKP_BYTES, urlMuatNaikDskp } from "@/lib/dskp/storage";
import { kunciServisSupabase } from "@/lib/rph/kunci-padam";
import { supabaseRuntimeConfig } from "@/lib/runtime-env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await connection();
    await kunciServisSupabase();
    const body = (await request.json().catch(() => ({}))) as { nama_fail?: string; saiz?: number };
    const namaFail = typeof body.nama_fail === "string" ? body.nama_fail.trim() : "";
    const saiz = typeof body.saiz === "number" ? body.saiz : 0;
    if (!namaFail.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ ralat: "Fail mestilah PDF DSKP." }, { status: 400 });
    }
    if (saiz <= 0 || saiz > MAX_DSKP_BYTES) {
      return NextResponse.json({ ralat: "Fail melebihi 15 MB." }, { status: 400 });
    }
    const muat = await urlMuatNaikDskp(namaFail);
    let signedUrl = muat.signedUrl;
    if (!signedUrl.startsWith("http")) {
      const asal = supabaseRuntimeConfig().url.replace(/\/$/, "");
      signedUrl = `${asal}/storage/v1${signedUrl.startsWith("/") ? "" : "/"}${signedUrl}`;
    }
    return NextResponse.json({ ...muat, signedUrl });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal sediakan muat naik PDF.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
