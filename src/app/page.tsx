import Link from "next/link";
import { BookOpen, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { senaraiDokumen } from "@/lib/dskp/queries";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabaseSedia = isSupabaseConfigured();
  const dokumen = supabaseSedia ? await senaraiDokumen() : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Dokumen DSKP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Simpan Bidang Pembelajaran, Standard Kandungan, dan Standard Pembelajaran daripada PDF
            rasmi KSSM.
          </p>
        </div>
        <Button asChild>
          <Link href="/muat-naik">
            <Upload />
            Muat naik DSKP
          </Link>
        </Button>
      </div>

      {!supabaseSedia ? (
        <Alert>
          <AlertTitle>Sambungkan Supabase</AlertTitle>
          <AlertDescription>
            Salin <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code> kepada{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>, kemudian
            jalankan SQL dalam <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/schema.sql</code>.
            Lihat <Link href="/panduan" className="underline">panduan</Link>.
          </AlertDescription>
        </Alert>
      ) : null}

      {dokumen.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <BookOpen className="mb-3 size-10 text-muted-foreground" />
            <h2 className="font-heading text-lg font-medium">Belum ada DSKP</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Muat naik PDF DSKP Tingkatan 4 atau dokumen KSSM lain. Sistem akan menyusun kandungannya
              ke dalam tiga jadual.
            </p>
            <Button asChild className="mt-4">
              <Link href="/muat-naik">Mula muat naik</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dokumen.map((item) => (
            <Link key={item.id} href={`/dskp/${item.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-base">
                    {item.mata_pelajaran ?? "DSKP"} {item.tingkatan ? `· ${item.tingkatan}` : ""}
                  </CardTitle>
                  <CardDescription>{item.nama_fail}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{item.bil_bidang} bidang</Badge>
                  <Badge variant="secondary">{item.bil_sk} SK</Badge>
                  <Badge variant="secondary">{item.bil_sp} SP</Badge>
                  {item.tahun_terbitan ? <Badge variant="outline">{item.tahun_terbitan}</Badge> : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
