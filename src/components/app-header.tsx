"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "DSKP" },
  { href: "/muat-naik", label: "Muat naik" },
  { href: "/jadual-waktu", label: "Jadual waktu" },
  { href: "/rph", label: "Borang RPH" },
  { href: "/panduan", label: "Panduan" },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookMarked className="size-4" />
          </span>
          <span>
            e-RPH
            <span className="ml-2 font-normal text-muted-foreground">DSKP</span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
