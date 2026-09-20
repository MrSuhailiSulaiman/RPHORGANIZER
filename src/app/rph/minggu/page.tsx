import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { PaparMingguRph } from "@/components/papar-minggu-rph";

export const dynamic = "force-dynamic";

export default function RphMingguPage() {
  return (
    <Suspense
      fallback={
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuatkan semua RPH minggu ini...
        </p>
      }
    >
      <PaparMingguRph />
    </Suspense>
  );
}
