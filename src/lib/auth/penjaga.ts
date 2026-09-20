import { NextResponse } from "next/server";
import { pastikanAdmin } from "./pengguna";
import { sesiDariKuki, type SesiPengguna } from "./sesi";

export async function sesiSemasa() {
  try {
    await pastikanAdmin();
  } catch {
    // Skema mungkin belum dipasang; halaman login akan tunjuk ralat semasa daftar/masuk.
  }
  return sesiDariKuki();
}

export async function wajibSesi(): Promise<
  { sesi: SesiPengguna; ralat: null } | { sesi: null; ralat: NextResponse }
> {
  const sesi = await sesiSemasa();
  if (!sesi) {
    return {
      sesi: null,
      ralat: NextResponse.json({ ralat: "Sila log masuk." }, { status: 401, headers: { "Cache-Control": "no-store" } }),
    };
  }
  return { sesi, ralat: null };
}
