import { connection } from "next/server";
import { NextResponse } from "next/server";
import { wajibAdmin } from "@/lib/auth/penjaga";
import { getPengguna } from "@/lib/auth/pengguna";
import { getJadualTerkini } from "@/lib/jadual/save";
import { getRphMengikutId, senaraiRph } from "@/lib/rph/save";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await wajibAdmin();
  if (auth.ralat) return auth.ralat;
  try {
    await connection();
    const { id } = await params;
    const pengguna = await getPengguna(id);
    if (!pengguna) {
      return NextResponse.json(
        { ralat: "Pengguna tidak dijumpai." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    const idsParam = new URL(request.url).searchParams.get("ids") ?? "";
    if (idsParam) {
      const rph = await getRphMengikutId(
        idsParam.split(/[,\s]+/).map((nilai) => nilai.trim()).filter(Boolean),
        pengguna.id
      );
      return NextResponse.json({ pengguna, rph }, { headers: { "Cache-Control": "no-store" } });
    }
    const [rph, jadual] = await Promise.all([senaraiRph(pengguna.id), getJadualTerkini(pengguna.id)]);
    return NextResponse.json(
      { pengguna, rph, jadual, sesi: jadual?.sesi ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan RPH pengguna.";
    return NextResponse.json({ ralat: mesej }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
