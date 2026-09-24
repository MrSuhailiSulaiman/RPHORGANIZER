import { cookies } from "next/headers";

export const NAMA_KUKI_SESI = "e_rph_sesi";
export const HAYAT_SESI_SAAT = 60 * 60 * 24 * 14;

export type PerananPengguna = "admin" | "pengguna";

export type SesiPengguna = {
  id: string;
  nama: string;
  peranan: PerananPengguna;
  exp: number;
};

function kunciSesi() {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "e-rph-kunci-sesi"
  );
}

function keBase64Url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function dariBase64Url(teks: string) {
  const pad = teks.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(teks: string) {
  const kunci = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(kunciSesi()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const tanda = await crypto.subtle.sign("HMAC", kunci, new TextEncoder().encode(teks));
  return keBase64Url(new Uint8Array(tanda));
}

function samaMasa(a: string, b: string) {
  if (a.length !== b.length) return false;
  let bez = 0;
  for (let i = 0; i < a.length; i += 1) bez |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return bez === 0;
}

export async function tandaSesi(muatan: Omit<SesiPengguna, "exp">) {
  const data: SesiPengguna = {
    ...muatan,
    exp: Date.now() + HAYAT_SESI_SAAT * 1000,
  };
  const json = keBase64Url(new TextEncoder().encode(JSON.stringify(data)));
  return `${json}.${await hmac(json)}`;
}

export async function bacaMuatanSesi(token: string | undefined | null): Promise<SesiPengguna | null> {
  if (!token) return null;
  const [json, sig] = token.split(".");
  if (!json || !sig) return null;
  const expected = await hmac(json);
  if (!samaMasa(expected, sig)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(dariBase64Url(json))) as SesiPengguna;
    if (!data?.id || !data.nama || (data.peranan !== "admin" && data.peranan !== "pengguna")) {
      return null;
    }
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function pilihanKukiSesi() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HAYAT_SESI_SAAT,
  };
}

export async function sesiDariKuki() {
  const store = await cookies();
  return bacaMuatanSesi(store.get(NAMA_KUKI_SESI)?.value);
}
