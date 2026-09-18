"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { padamSemuaRekodRph } from "@/app/rph/padam-rph";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

function ButangHantar({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  const tutup = disabled || pending;
  return (
    <button
      type="submit"
      disabled={tutup}
      className={cn(buttonVariants({ variant: "destructive", size: "lg" }))}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      {pending ? "Memadam rekod RPH..." : "Padam RPH setahun"}
    </button>
  );
}

export function BorangPadamRph({ disabled }: { disabled?: boolean }) {
  return (
    <form action={padamSemuaRekodRph}>
      <fieldset disabled={disabled} className="contents">
        <ButangHantar disabled={disabled} />
      </fieldset>
    </form>
  );
}
