import { NextResponse } from "next/server";
import { padamRphDalamTempoh } from "@/lib/rph/save";
import { BIL_MINGGU_TAHUN, isninPadaAtauSelepas, tarikhMulaTahunAsal, tarikhSlot } from "@/lib/rph/tahun";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { tarikh_mula?: string };
    const tarikhMula = isninPadaAtauSelepas(body.tarikh_mula || tarikhMulaTahunAsal());
    const tarikhTamat = tarikhSlot(tarikhMula, BIL_MINGGU_TAHUN, "JUMAAT");
    const bilangan = await padamRphDalamTempoh(tarikhMula, tarikhTamat);
    return NextResponse.json({
      tarikh_mula: tarikhMula,
      tarikh_tamat: tarikhTamat,
      bil_rph: bilangan,
    });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
