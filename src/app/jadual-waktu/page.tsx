import { TetapanJadualWaktu } from "@/components/tetapan-jadual-waktu";
import { TetapanMataPelajaran } from "@/components/tetapan-mata-pelajaran";

export const dynamic = "force-dynamic";

export default function JadualWaktuPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Tetapan jadual waktu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jadual ini milik akaun anda. Guru lain tidak dapat melihatnya. Muat naik gambar atau PDF
          jadual, kemudian Gemini pecahkan setiap waktu kepada sesi PdP untuk borang RPH.
        </p>
      </div>
      <TetapanMataPelajaran />
      <TetapanJadualWaktu />
    </div>
  );
}
