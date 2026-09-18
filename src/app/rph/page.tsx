import { headers } from "next/headers";
import Link from "next/link";
import { CalendarClock, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SenaraiRph } from "@/components/senarai-rph";
import { cn } from "cn";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function RphPage({
  searchParams,
}: {
  searchParams: Promise<{ padam?: string; n?: string; m?: string }>;
}) {
  const { padam, n, m } = await searchParams;
  const kepala = await headers();
  const host = kepala.get("x-forwarded-host") ?? kepala.get("host") ?? "rphorganizer.vercel.app";
  const proto = kepala.get("x-forwarded-proto") ?? "https";
  const padamAction = `${proto}://${host}/rph/padam`;

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
        </div>
      </div>
      {padam === "ok" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Semua rekod dalam jadual rph telah dipadam. Jadual waktu di bawah tidak dipadam.
        </p>
      ) : null}
      {padam === "gagal" || padam === "kunci" ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {m ? decodeURIComponent(m) : "Gagal memadam rekod RPH dalam Supabase. Cuba lagi."}
        </p>
      ) : null}
      {padam === "baki" ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {n ?? "Beberapa"} rekod RPH masih wujud dalam Supabase.
        </p>
      ) : null}
      <form action={padamAction} method="post">
        <button type="submit" className={cn(buttonVariants({ variant: "destructive", size: "lg" }))}>
          <Trash2 />
          Padam RPH setahun
        </button>
      </form>
      <SenaraiRph padamBerjaya={padam === "ok"} padamAction={padamAction} />
    </div>
  );
}
