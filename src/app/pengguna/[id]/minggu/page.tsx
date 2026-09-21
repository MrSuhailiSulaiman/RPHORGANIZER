import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PaparMingguRphPengguna } from "@/components/papar-minggu-rph-pengguna";
import { sesiSemasa } from "@/lib/auth/penjaga";
import { getPengguna } from "@/lib/auth/pengguna";

export const dynamic = "force-dynamic";

export default async function PenggunaMingguPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesi = await sesiSemasa();
  if (!sesi) redirect("/masuk");
  if (sesi.peranan !== "admin") redirect("/");
  const { id } = await params;
  const pengguna = await getPengguna(id);
  if (!pengguna) notFound();

  return (
    <Suspense
      fallback={
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuatkan semua RPH minggu ini...
        </p>
      }
    >
      <PaparMingguRphPengguna penggunaId={pengguna.id} />
    </Suspense>
  );
}
