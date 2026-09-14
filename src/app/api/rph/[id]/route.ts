import { NextResponse } from "next/server";
import { getRph } from "@/lib/rph/save";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rph = await getRph(id);
    if (!rph) {
      return NextResponse.json({ ralat: "RPH tidak dijumpai." }, { status: 404 });
    }
    return NextResponse.json({ rph });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
