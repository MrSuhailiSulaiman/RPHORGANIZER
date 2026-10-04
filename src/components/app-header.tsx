"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButangKeluarPadat, pautanAktif, senaraiNav, sorokNavigasi } from "@/components/navigasi-peranti";
import { cn } from "@/lib/utils";

export function AppHeader({
  pengguna,
}: {
  pengguna?: { nama: string; peranan: string } | null;
}) {
  const pathname = usePathname();
  const sorok = sorokNavigasi(pathname, Boolean(pengguna));
  const nav = senaraiNav(pengguna?.peranan);

  return (
    <header className={cn("border-b bg-card/80 backdrop-blur", sorok ? "" : "md:hidden xl:block")}>
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5">
        <Link
          href={sorok ? "/masuk" : "/"}
          className="flex shrink-0 items-center gap-2 font-heading text-sm font-semibold tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookMarked className="size-4" />
          </span>
          <span>RPH Organizer</span>
        </Link>
        {sorok ? null : (
          <>
            <nav className="hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 xl:flex">
              {nav.map((item) => {
                const active = pautanAktif(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {pengguna ? (
              <div className="ml-auto flex shrink-0 items-center gap-3 xl:border-l xl:border-border xl:pl-4">
                <div className="hidden items-center gap-2 xl:flex">
                  <span className="text-sm font-medium uppercase">{pengguna.nama}</span>
                  <Badge variant={pengguna.peranan === "admin" ? "default" : "secondary"}>
                    {pengguna.peranan === "admin" ? "Admin" : "Pengguna Biasa"}
                  </Badge>
                </div>
                <span className="xl:hidden">
                  <ButangKeluarPadat />
                </span>
                <form action="/api/auth/keluar" method="post" className="hidden xl:block">
                  <Button type="submit" variant="ghost" size="sm">
                    <LogOut />
                    Log keluar
                  </Button>
                </form>
              </div>
            ) : null}
          </>
        )}
      </div>
    </header>
  );
}
