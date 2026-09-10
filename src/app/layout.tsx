import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppChrome from "@/components/nav/NavHeader";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kairo · Section Playground",
  description: "Draft area for new Kairo.ai website sections.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Material Symbols for the arc's centre glyphs. In the app router this
            <link> is hoisted to <head> and loads for every route.
            eslint-disable-next-line rules below are pages-router heuristics. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block"
        />
        {/* Fixed, non-scrolling shell — each route is its own full-viewport
            page. The nav above persists across navigations; only the page
            content below it swaps. */}
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#050505] text-zinc-200">
          <AppChrome>
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </main>
          </AppChrome>
        </div>
      </body>
    </html>
  );
}
