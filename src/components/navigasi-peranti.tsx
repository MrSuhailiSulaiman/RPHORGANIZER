"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  LogOut,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PautanNav = {
  href: string;
  label: string;
  ringkas: string;
  icon: LucideIcon;
};

const NAV: PautanNav[] = [
  { href: "/", label: "DSKP", ringkas: "DSKP", icon: BookOpen },
  { href: "/muat-naik", label: "Muat naik", ringkas: "Muat naik", icon: Upload },
  { href: "/jadual-waktu", label: "Jadual waktu", ringkas: "Jadual", icon: CalendarDays },
  { href: "/rph", label: "Borang RPH", ringkas: "RPH", icon: ClipboardList },
  { href: "/panduan", label: "Panduan", ringkas: "Panduan", icon: CircleHelp },
];

export function senaraiNav(peranan?: string) {
  if (peranan === "admin") {
    return [...NAV, { href: "/pengguna", label: "Senarai pengguna", ringkas: "Pengguna", icon: Users }];
  }
  return NAV;
}

export function pautanAktif(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function sorokNavigasi(pathname: string, adaPengguna: boolean) {
  return pathname === "/masuk" || (pathname.startsWith("/kongsi") && !adaPengguna);
}

function ButangKeluar({ padat = false }: { padat?: boolean }) {
  return (
    <form action="/api/auth/keluar" method="post">
      <Button type="submit" variant="ghost" size={padat ? "icon" : "sm"} aria-label="Log keluar">
        <LogOut />
        {padat ? null : "Log keluar"}
      </Button>
    </form>
  );
}

export function NavigasiTelefon({
  pengguna,
}: {
  pengguna?: { nama: string; peranan: string } | null;
}) {
  const pathname = usePathname();
  if (sorokNavigasi(pathname, Boolean(pengguna))) return null;
  const nav = senaraiNav(pengguna?.peranan);

  return (
    <nav
      aria-label="Navigasi telefon"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map((item) => {
          const aktif = pautanAktif(pathname, item.href);
          const Ikon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] leading-tight",
                aktif ? "font-medium text-primary" : "text-muted-foreground"
              )}
            >
              <Ikon className="size-5" />
              <span className="truncate">{item.ringkas}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function NavigasiTablet({
  pengguna,
}: {
  pengguna?: { nama: string; peranan: string } | null;
}) {
  const pathname = usePathname();
  if (sorokNavigasi(pathname, Boolean(pengguna))) return null;
  const nav = senaraiNav(pengguna?.peranan);

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card md:flex xl:hidden">
      <Link href="/" className="flex items-center gap-2 px-4 py-4 font-heading text-sm font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BookMarked className="size-4" />
        </span>
        e-RPH
      </Link>
      <nav aria-label="Navigasi tablet" className="flex flex-1 flex-col gap-1 px-3">
        {nav.map((item) => {
          const aktif = pautanAktif(pathname, item.href);
          const Ikon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                aktif ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              <Ikon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {pengguna ? (
        <div className="space-y-3 border-t px-4 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium uppercase">{pengguna.nama}</p>
            <Badge variant={pengguna.peranan === "admin" ? "default" : "secondary"} className="mt-1">
              {pengguna.peranan === "admin" ? "Admin" : "Pengguna Biasa"}
            </Badge>
          </div>
          <ButangKeluar />
        </div>
      ) : null}
    </aside>
  );
}

export function ButangKeluarPadat() {
  return <ButangKeluar padat />;
}
