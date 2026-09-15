import { connection } from "next/server";
import { NextResponse } from "next/server";
import { padamSemuaRph } from "@/lib/rph/save";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const fetchCache = "force-no-store";

async function padam() {
  await connection();
  const bilangan = await padamSemuaRph();
  return NextResponse.json(
    { bil_rph: bilangan },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE() {
  try {
    return await padam();
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}

export async function POST() {
  try {
    return await padam();
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memadam RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
