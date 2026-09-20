import { NextResponse } from "next/server";
import { wajibSesi } from "@/lib/auth/penjaga";
import { getSesi } from "@/lib/jadual/save";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    const { id } = await params;
    const sesi = await getSesi(id, auth.sesi.id);
    if (!sesi) {
      return NextResponse.json({ ralat: "Sesi PdP tidak dijumpai." }, { status: 404 });
    }
    return NextResponse.json({ sesi });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan sesi.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
