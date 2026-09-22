import { connection } from "next/server";
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { wajibSesi } from "@/lib/auth/penjaga";
import { paparanKongsiRph, tandaKongsiRph } from "@/lib/rph/kongsi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function asal(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  await connection();
  const token = new URL(request.url).searchParams.get("t") ?? "";
  try {
    const paparan = await paparanKongsiRph(token);
    if (!paparan) {
      return NextResponse.json({ ralat: "Pautan kongsi tidak sah." }, { status: 404 });
    }
    return NextResponse.json(paparan, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal memuatkan RPH.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await wajibSesi();
  if (auth.ralat) return auth.ralat;
  try {
    const body = (await request.json().catch(() => ({}))) as { minggu?: unknown };
    const minggu = Number(body.minggu);
    if (!Number.isInteger(minggu) || minggu < 1) {
      return NextResponse.json({ ralat: "Minggu tidak sah." }, { status: 400 });
    }
    const token = await tandaKongsiRph({ uid: auth.sesi.id, minggu });
    const url = `${asal(request)}/kongsi/rph?t=${encodeURIComponent(token)}`;
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" });
    return NextResponse.json({ url, qr });
  } catch (error) {
    const mesej = error instanceof Error ? error.message : "Gagal menyediakan pautan kongsi.";
    return NextResponse.json({ ralat: mesej }, { status: 500 });
  }
}
