"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

function posPadam(): Promise<{ ok: boolean; json: { ralat?: string; bil_rph?: number; baki?: number } }> {
  return new Promise((selesai, gagal) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${window.location.origin}/api/rph/tahun?t=${Date.now()}`);
    xhr.setRequestHeader("Cache-Control", "no-store");
    xhr.onload = () => {
      let json: { ralat?: string; bil_rph?: number; baki?: number } = {};
      try {
        json = JSON.parse(xhr.responseText) as typeof json;
      } catch {
        json = {};
      }
      selesai({ ok: xhr.status >= 200 && xhr.status < 300, json });
    };
    xhr.onerror = () => gagal(new Error("Rangkaian gagal semasa memadam RPH."));
    xhr.send();
  });
}

export function BorangPadamRph() {
  const [pending, setPending] = useState(false);

  async function padam() {
    if (pending) return;
    setPending(true);
    try {
      let hasil: { ok: boolean; json: { ralat?: string; bil_rph?: number; baki?: number } } = {
        ok: false,
        json: {},
      };
      for (let cubaan = 0; cubaan < 5; cubaan += 1) {
        hasil = await posPadam();
        if (hasil.ok && !(hasil.json.baki ?? 0)) break;
        if (cubaan < 4) await new Promise((tunggu) => setTimeout(tunggu, 300 * (cubaan + 1)));
      }
      if (!hasil.ok || (hasil.json.baki ?? 0) > 0) {
        throw new Error(hasil.json.ralat ?? "Gagal memadam rekod RPH dalam Supabase.");
      }
      toast.success(`${hasil.json.bil_rph ?? 0} rekod jadual rph telah dipadam.`);
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
