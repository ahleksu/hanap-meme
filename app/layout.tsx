import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Archivo_Black, Geist_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const archivoBlack = Archivo_Black({ variable: "--font-archivo-black", weight: "400", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HanapMeme · Google for Pinoy memes",
  description: "Search Filipino memes in Taglish, via web, REST API, and MCP.",
};

const nav = [
  ["/search", "Hanap"],
  ["/generate", "Gawa"],
  ["/#integrate", "API & MCP"],
  ["/about", "Rights"],
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${archivoBlack.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <a href="#main" className="label sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:p-2 focus:text-accent-ink">
          Skip to content
        </a>
        <header className="relative z-20">
          <nav className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-7 gap-y-2 px-5 py-6 sm:px-12">
            <Link href="/" className="display mr-auto text-2xl uppercase tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              Hanap<span className="text-accent">Meme</span>*
            </Link>
            {nav.map(([href, label]) => (
              <Link key={href} href={href} className="label hover:text-accent">
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main id="main" className="flex-1">{children}</main>
        <footer className="border-t-2 border-line px-5 py-8 sm:px-12">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
            <p className="label text-accent">Images are not owned by HanapMeme. Rights unverified. Click Report to remove.</p>
            <p className="label text-muted">
              <Link href="/about" className="hover:text-foreground">Assets & rights</Link> ·{" "}
              <Link href="/takedown" className="hover:text-foreground">Takedown</Link> · MIT code
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
