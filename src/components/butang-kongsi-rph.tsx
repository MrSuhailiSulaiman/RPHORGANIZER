"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ButangKongsiRph({ minggu, disabled }: { minggu: number; disabled?: boolean }) {
  const [buka, setBuka] = useState(false);
  const [sedang, setSedang] = useState(false);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [disalin, setDisalin] = useState(false);

  useEffect(() => {
    setUrl("");
    setQr("");
    setDisalin(false);
  }, [minggu]);

  async function bukaKongsi() {
    if (disabled || sedang) return;
    setBuka(true);
    if (url && qr) return;
    setSedang(true);
    try {
      const res = await fetch("/api/kongsi/rph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minggu }),
      });
      const json = (await res.json().catch(() => ({}))) as { ralat?: string; url?: string; qr?: string };
      if (!res.ok || !json.url || !json.qr) throw new Error(json.ralat ?? "Gagal menyediakan pautan kongsi.");
      setUrl(json.url);
      setQr(json.qr);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyediakan pautan kongsi.");
      setBuka(false);
    } finally {
      setSedang(false);
    }
  }

  async function salin() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setDisalin(true);
      toast.success("Pautan disalin.");
      window.setTimeout(() => setDisalin(false), 2000);
    } catch {
      toast.error("Gagal menyalin pautan.");
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => void bukaKongsi()} disabled={disabled || sedang}>
        {sedang ? <Loader2 className="animate-spin" /> : <Share2 />}
        Kongsi
      </Button>
      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kongsi RPH Minggu {minggu}</DialogTitle>
            <DialogDescription>
              Sesiapa dengan pautan ini boleh lihat RPH minggu ini. Mereka tidak boleh mengedit.
            </DialogDescription>
          </DialogHeader>
          {sedang && !url ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Menyediakan pautan...
            </p>
          ) : (
            <div className="space-y-4">
              <Button type="button" className="w-full" onClick={() => void salin()} disabled={!url}>
                {disalin ? <Check /> : <Copy />}
                {disalin ? "Disalin" : "Salin pautan"}
              </Button>
              <div className="rounded-lg border bg-muted/40 px-3 py-4 text-center">
                <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <QrCode className="size-3.5" />
                  Kod QR
                </p>
                {qr ? (
                  <img src={qr} alt={`Kod QR RPH minggu ${minggu}`} className="mx-auto size-52 rounded-md bg-white p-2" />
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">Imbas kod ini untuk buka paparan RPH.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
