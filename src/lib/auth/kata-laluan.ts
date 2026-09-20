import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashKataLaluan(kata: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(kata, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function sahkanKataLaluan(kata: string, tersimpan: string) {
  const [salt, hash] = tersimpan.split(":");
  if (!salt || !hash) return false;
  try {
    const actual = scryptSync(kata, salt, 32);
    const expected = Buffer.from(hash, "hex");
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function normalNamaPengguna(nilai: string) {
  return nilai.trim().toLowerCase();
}

export function sahNamaPengguna(nilai: string) {
  return /^[a-z0-9._-]{3,32}$/.test(normalNamaPengguna(nilai));
}
