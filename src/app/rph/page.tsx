import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SenaraiRph } from "@/components/senarai-rph";

export const dynamic = "force-dynamic";

export default function RphPage() {
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
      <SenaraiRph />
    </div>
  );
}
