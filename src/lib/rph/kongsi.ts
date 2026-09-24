import { getPengguna } from "@/lib/auth/pengguna";
import { getRphMengikutId, senaraiRph } from "@/lib/rph/save";
import { bandingSesiRph, kumpulanMingguRph } from "@/lib/rph/tahun";
import type { RphRekod } from "@/lib/rph/types";

export type MuatanKongsiRph = {
  uid: string;
  minggu: number;
};

export type PaparanKongsiRph = {
  minggu: number;
  nama: string;
  tarikh_mula?: string;
  tarikh_tamat?: string;
  rph: RphRekod[];
};

function kunciKongsi() {
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
    new TextEncoder().encode(kunciKongsi()),
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

export async function tandaKongsiRph(muatan: MuatanKongsiRph) {
  const data = { k: "rph", uid: muatan.uid, minggu: muatan.minggu };
  const json = keBase64Url(new TextEncoder().encode(JSON.stringify(data)));
  return `${json}.${await hmac(`kongsi-rph:${json}`)}`;
}

export async function bacaKongsiRph(token: string | undefined | null): Promise<MuatanKongsiRph | null> {
  if (!token) return null;
  const [json, sig] = token.split(".");
  if (!json || !sig) return null;
  const expected = await hmac(`kongsi-rph:${json}`);
  if (!samaMasa(expected, sig)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(dariBase64Url(json))) as {
      k?: string;
      uid?: string;
      minggu?: number;
    };
    if (data.k !== "rph" || !data.uid || typeof data.minggu !== "number" || data.minggu < 1) {
      return null;
    }
    return { uid: data.uid, minggu: data.minggu };
  } catch {
    return null;
  }
}

export async function paparanKongsiRph(token: string | undefined | null): Promise<PaparanKongsiRph | null> {
  const muatan = await bacaKongsiRph(token);
  if (!muatan) return null;
  const [pengguna, senarai] = await Promise.all([getPengguna(muatan.uid), senaraiRph(muatan.uid)]);
  if (!pengguna) return null;
  const kumpulan = kumpulanMingguRph(senarai);
  const sasaran = kumpulan.find((item) => item.minggu === muatan.minggu);
  if (!sasaran) return { minggu: muatan.minggu, nama: pengguna.nama_pengguna, rph: [] };
  const ids = sasaran.item.map((item) => item.id).filter(Boolean);
  const penuh = (await getRphMengikutId(ids, muatan.uid)).sort(bandingSesiRph);
  return {
    minggu: muatan.minggu,
    nama: pengguna.nama_pengguna,
    tarikh_mula: sasaran.tarikh_mula,
    tarikh_tamat: sasaran.tarikh_tamat,
    rph: penuh,
  };
}
