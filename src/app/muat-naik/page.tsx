import { UploadDskp } from "@/components/upload-dskp";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default function MuatNaikPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Muat naik DSKP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF dianalisis kepada Bidang Pembelajaran, Standard Kandungan, dan Standard Pembelajaran
          sebelum disimpan. Isi mata pelajaran dan tingkatan terlebih dahulu.
        </p>
      </div>
      <UploadDskp supabaseSedia={isSupabaseConfigured()} />
    </div>
  );
}
