"use client";

import { Label } from "@/components/ui/label";
import { labelMingguRph } from "@/lib/rph/tahun";

type PilihanMinggu = {
  minggu: number;
  tarikh_mula?: string | null;
  tarikh_tamat?: string | null;
};

export function TapisMingguRph({
  kumpulan,
  nilai,
  onChange,
  termasukSemua = false,
}: {
  kumpulan: PilihanMinggu[];
  nilai: number | "semua";
  onChange: (nilai: number | "semua") => void;
  termasukSemua?: boolean;
}) {
  if (!kumpulan.length) return null;

  return (
    <Label className="font-normal text-muted-foreground">
      Tapis minggu
      <select
        aria-label="Tapis RPH mengikut minggu"
        className="h-8 min-w-[16rem] rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        value={nilai === "semua" ? "semua" : String(nilai)}
        onChange={(event) => {
          const pilih = event.target.value;
          onChange(pilih === "semua" ? "semua" : Number(pilih));
        }}
      >
        {termasukSemua ? <option value="semua">Semua minggu</option> : null}
        {kumpulan.map((kumpul) => (
          <option key={kumpul.minggu} value={kumpul.minggu}>
            {labelMingguRph(kumpul)}
          </option>
        ))}
      </select>
    </Label>
  );
}
