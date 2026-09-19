import { createAdminClient } from "@/lib/supabase/admin";

export const DSKP_BUCKET = "dskp-pdf";
export const MAX_DSKP_BYTES = 15 * 1024 * 1024;

export function laluanSimpananDskp(namaFail: string) {
  const nama = namaFail.replace(/[^\w.\- ()]/g, "_") || "dskp.pdf";
  return `${crypto.randomUUID()}/${nama}`;
}

export async function urlMuatNaikDskp(namaFail: string) {
  const supabase = createAdminClient();
  const path = laluanSimpananDskp(namaFail);
  const { data, error } = await supabase.storage.from(DSKP_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl || !data.path) {
    throw new Error(error?.message || "Gagal sediakan muat naik PDF.");
  }
  return {
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

export async function muatTurunDskp(path: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(DSKP_BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message || "Gagal baca PDF dari storan.");
  }
  return new Uint8Array(await data.arrayBuffer());
}
