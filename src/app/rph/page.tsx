import Link from "next/link";
import { CalendarClock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SenaraiRph } from "@/components/senarai-rph";

export const dynamic = "force-dynamic";

export default async function RphPage({
  searchParams,
}: {
  searchParams: Promise<{ padam?: string; n?: string }>;
}) {
  const { padam, n } = await searchParams;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Borang RPH</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jana RPH setahun daripada jadual dan DSKP, atau isi borang satu sesi.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/jadual-waktu">
              <CalendarClock />
              Tetapan jadual
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/rph/baru">Borang kosong</Link>
          </Button>
          <form action="/rph/padam" method="post">
            <Button type="submit" variant="destructive">
              <Trash2 />
              Padam RPH setahun
            </Button>
          </form>
        </div>
      </div>
      {padam === "ok" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Semua rekod RPH telah dipadam daripada Supabase. Jadual waktu di bawah tidak dipadam.
        </p>
      ) : null}
      {padam === "gagal" || padam === "kunci" ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Gagal memadam rekod RPH dalam Supabase. Cuba lagi.
        </p>
      ) : null}
      {padam === "baki" ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {n ?? "Beberapa"} rekod RPH masih wujud dalam Supabase.
        </p>
      ) : null}
      <SenaraiRph padamBerjaya={padam === "ok"} />
    </div>
  );
}
