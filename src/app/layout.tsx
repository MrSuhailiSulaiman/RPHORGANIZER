import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { Providers } from "@/components/providers";
import { sesiSemasa } from "@/lib/auth/penjaga";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "e-RPH · DSKP",
  description: "Simpan Bidang Pembelajaran, Standard Kandungan dan Standard Pembelajaran daripada PDF DSKP KSSM.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sesi = await sesiSemasa();
  return (
    <html
      lang="ms"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <AppHeader pengguna={sesi ? { nama: sesi.nama, peranan: sesi.peranan } : null} />
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
