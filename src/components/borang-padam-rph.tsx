"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export function BorangPadamRph() {
  const [pending, setPending] = useState(false);

  async function padam() {
    if (pending) return;
    setPending(true);
    try {
      let json: { ralat?: string; bil_rph?: number; baki?: number } = {};
      let res: Response | null = null;
      for (let cubaan = 0; cubaan < 5; cubaan += 1) {
        res = await fetch(`/api/rph/tahun?t=${Date.now()}`, {
          method: "POST",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        json = (await res.json().catch(() => ({}))) as {
          ralat?: string;
          bil_rph?: number;
          baki?: number;
        };
        if (res.ok && !(json.baki ?? 0)) break;
        if (cubaan < 4) await new Promise((selesai) => setTimeout(selesai, 300 * (cubaan + 1)));
      }
      if (!res?.ok || (json.baki ?? 0) > 0) {
        throw new Error(json.ralat ?? "Gagal memadam rekod RPH dalam Supabase.");
      }
      toast.success(`${json.bil_rph ?? 0} rekod jadual rph telah dipadam.`);
      window.location.assign("/rph?padam=ok");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memadam RPH.");
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void padam()}
      disabled={pending}
      className={cn(buttonVariants({ variant: "destructive", size: "lg" }))}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      {pending ? "Memadam rekod RPH..." : "Padam RPH setahun"}
    </button>
  );
}
