import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { RujukanMataPelajaran } from "./parse";

export async function muatRujukanMataPelajaran(): Promise<RujukanMataPelajaran[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("mata_pelajaran").select("kod, nama");
    if (error || !data) return [];
    return data.flatMap((row) => {
      const kod = typeof row.kod === "string" ? row.kod.trim() : "";
      const nama = typeof row.nama === "string" ? row.nama.trim() : "";
      return kod && nama ? [{ kod, nama }] : [];
    });
  } catch {
    return [];
  }
}
