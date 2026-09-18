import { Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export function BorangPadamRph({ action }: { action: string }) {
  return (
    <form action={action} method="post">
      <button type="submit" className={cn(buttonVariants({ variant: "destructive", size: "lg" }))}>
        <Trash2 />
        Padam RPH setahun
      </button>
    </form>
  );
}
