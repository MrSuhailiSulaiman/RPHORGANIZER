import { NextResponse } from "next/server";
import { padamSemuaRph } from "@/lib/rph/save";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function padam() {
  const bilangan = await padamSemuaRph();
  return NextResponse.json({ bil_rph: bilangan });
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
