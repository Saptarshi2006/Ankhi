import type { Metadata, Viewport } from "next";
import { Fraunces, Literata } from "next/font/google";
import { site } from "@/content/site";
import { SmoothScroll } from "@/lib/smooth-scroll";
import "./globals.css";

/**
 * Fraunces carries a SOFT and WONK axis; both are dialled up here. WONK swaps
 * in the flared, slightly-off letterforms that keep a romantic serif from
 * reading as a wedding invitation.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
  display: "swap",
});

/**
 * Literata is drawn for long-form reading, which is exactly what the letter
 * is. It holds up at the 1.05–1.35rem range the letter renders at.
 */
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${site.titleLeft} ${site.titleRight}, ${site.name.split(" ")[0]}`,
  description:
    "A small corner of the internet for Ankhi Debnath, on her nineteenth birthday.",
};

export const viewport: Viewport = {
  themeColor: "#fdf3ef",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${literata.variable} antialiased`}
    >
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
