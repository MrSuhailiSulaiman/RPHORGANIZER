import { BorangDaftar } from "@/components/borang-daftar";

export const dynamic = "force-dynamic";

export default function HalamanDaftar() {
  return (
    <div className="flex flex-1 items-center py-8">
      <BorangDaftar />
    </div>
  );
}
