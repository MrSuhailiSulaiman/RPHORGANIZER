import { TetapanJadualWaktu } from "@/components/tetapan-jadual-waktu";

export const dynamic = "force-dynamic";

export default function JadualWaktuPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Tetapan jadual waktu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Muat naik jadual waktu. Setiap slot menjadi sesi PdP (kelas, hari, masa, mata pelajaran)
          yang disambungkan ke borang RPH.
        </p>
      </div>
      <TetapanJadualWaktu />
    </div>
  );
}
