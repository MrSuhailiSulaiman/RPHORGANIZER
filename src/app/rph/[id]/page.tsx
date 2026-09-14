import { BorangRph } from "@/components/borang-rph";

export const dynamic = "force-dynamic";

export default async function RphDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">RPH tersimpan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Semak atau kemaskini rancangan pengajaran harian.</p>
      </div>
      <BorangRph rphId={id} />
    </div>
  );
}
