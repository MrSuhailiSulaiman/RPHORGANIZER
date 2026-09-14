import { BorangRph } from "@/components/borang-rph";

export const dynamic = "force-dynamic";

export default async function RphBaruPage({
  searchParams,
}: {
  searchParams: Promise<{ sesi?: string }>;
}) {
  const { sesi } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Isi RPH</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tarikh, hari, masa, kelas, dan mata pelajaran diambil daripada sesi PdP pada jadual waktu.
        </p>
      </div>
      <BorangRph sesiId={sesi} />
    </div>
  );
}
