"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export function BorangPadamRph({ disabled }: { disabled?: boolean }) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action="/rph/padam"
      method="post"
      onSubmit={(event) => {
        if (disabled || pending) {
          event.preventDefault();
          return;
        }
        setPending(true);
        event.preventDefault();
        HTMLFormElement.prototype.submit.call(event.currentTarget);
      }}
    >
      <button
        type="submit"
        disabled={disabled || pending}
        className={cn(buttonVariants({ variant: "destructive", size: "lg" }))}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {pending ? "Memadam rekod RPH..." : "Padam RPH setahun"}
      </button>
    </form>
  );
}
