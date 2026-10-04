import Link from "next/link";
import { BookOpen, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-xs font-medium text-muted-foreground">Mata pelajaran</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Tingkatan</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">Bidang</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">SK</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">SP</TableHead>
                <TableHead className="pr-4 text-right text-xs font-medium text-muted-foreground">Tahun</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dokumen.map((item) => (
                <TableRow key={item.id} className="relative">
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/dskp/${item.id}`} className="after:absolute after:inset-0">
                      {item.mata_pelajaran ?? "DSKP"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.tingkatan || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.bil_bidang}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.bil_sk}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.bil_sp}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">
                    {item.tahun_terbitan || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
