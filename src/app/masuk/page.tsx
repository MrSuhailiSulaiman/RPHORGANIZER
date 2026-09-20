import { Suspense } from "react";
import { BorangMasuk } from "@/components/borang-masuk";

export const dynamic = "force-dynamic";

export default function HalamanMasuk() {
  return (
    <div className="flex flex-1 items-center py-8">
      <Suspense>
        <BorangMasuk />
      </Suspense>
    </div>
  );
}
